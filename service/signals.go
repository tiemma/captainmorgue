package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
)

const (
	signalPoints  = 15
	signalStep    = 30 * time.Second
	signalTimeout = 10 * time.Second
)

type signalSpec struct {
	key, label     string
	query          string
	warn, critical float64
	format         string
}

var signalSpecs = []signalSpec{
	{key: "requests", label: "request rate", format: "%.1f/s",
		query: `sum by (service_name) (rate({otel_metric_name="dash0.spans", otel_span_kind="SERVER", service_name=~"%[1]s"}[2m]))`},
	{key: "errors", label: "error rate", format: "%.1f%%", warn: 1, critical: 5,
		query: `100 * (sum by (service_name) (rate({otel_metric_name="dash0.spans", otel_span_kind="SERVER", otel_span_status_code="ERROR", service_name=~"%[1]s"}[2m])) or (0 * sum by (service_name) (rate({otel_metric_name="dash0.spans", otel_span_kind="SERVER", service_name=~"%[1]s"}[2m])))) / sum by (service_name) (rate({otel_metric_name="dash0.spans", otel_span_kind="SERVER", service_name=~"%[1]s"}[2m]))`},
	{key: "p95", label: "p95 latency", format: "%.0f ms", warn: 500, critical: 1000,
		query: `histogram_quantile(0.95, sum by (service_name) (rate({otel_metric_name="dash0.spans.duration", otel_span_kind="SERVER", service_name=~"%[1]s"}[2m]))) * 1000`},
}

type dash0 struct {
	url, token, dataset string
	client              *http.Client
	failing             bool
}

func newDash0() *dash0 {
	token := os.Getenv("DASH0_AUTH_TOKEN")
	if token == "" {
		slog.Info("dash0 signals off: DASH0_AUTH_TOKEN unset")
		return nil
	}
	return &dash0{url: strings.TrimRight(env("DASH0_API_URL", "https://api.us-west-2.aws.dash0.com"), "/"), token: token, dataset: os.Getenv("DASH0_DATASET"), client: &http.Client{Timeout: signalTimeout}}
}

type promResponse struct {
	Status string `json:"status"`
	Error  string `json:"error"`
	Data   struct {
		Result []struct {
			Metric map[string]string `json:"metric"`
			Values [][2]any          `json:"values"`
		} `json:"result"`
	} `json:"data"`
}

func (d *dash0) queryRange(ctx context.Context, query string, end time.Time) (map[string][]float64, error) {
	q := url.Values{
		"query": {query},
		"start": {strconv.FormatInt(end.Add(-signalStep*(signalPoints-1)).Unix(), 10)},
		"end":   {strconv.FormatInt(end.Unix(), 10)},
		"step":  {strconv.Itoa(int(signalStep.Seconds()))},
	}
	if d.dataset != "" {
		q.Set("dataset", d.dataset)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, d.url+"/api/prometheus/api/v1/query_range?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+d.token)
	resp, err := d.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var pr promResponse
	if err := json.NewDecoder(resp.Body).Decode(&pr); err != nil {
		return nil, fmt.Errorf("query_range %s: %w", resp.Status, err)
	}
	if resp.StatusCode != http.StatusOK || pr.Status != "success" {
		return nil, fmt.Errorf("query_range %s: %s", resp.Status, pr.Error)
	}
	out := map[string][]float64{}
	for _, r := range pr.Data.Result {
		var series []float64
		for _, v := range r.Values {
			s, _ := v[1].(string)
			f, err := strconv.ParseFloat(s, 64)
			if err != nil {
				return nil, fmt.Errorf("query_range value %q: %w", s, err)
			}
			if !math.IsNaN(f) && !math.IsInf(f, 0) {
				series = append(series, f)
			}
		}
		out[r.Metric["service_name"]] = series
	}
	return out, nil
}

func signalKey(service, metric string) string {
	return service + "_" + metric
}

func (s signalSpec) status(v float64) string {
	switch {
	case s.critical > 0 && v >= s.critical:
		return "critical"
	case s.warn > 0 && v >= s.warn:
		return "warn"
	}
	return "ok"
}

func spark(series []float64) []float64 {
	lo, hi := slices.Min(series), slices.Max(series)
	out := make([]float64, len(series))
	for i, v := range series {
		if hi > lo {
			out[i] = (v - lo) / (hi - lo)
		} else {
			out[i] = 0.5
		}
	}
	return out
}

func (inc *Incident) owned() []string {
	var services []string
	for _, t := range inc.roster.Teams {
		services = append(services, t.Owns...)
	}
	return services
}

func (inc *Incident) pollSignals(d *dash0, every time.Duration) {
	for range time.Tick(every) {
		inc.mu.Lock()
		open := inc.isOpen()
		inc.mu.Unlock()
		if open {
			inc.refreshSignals(d)
		}
	}
}

func (inc *Incident) refreshSignals(d *dash0) {
	services := inc.owned()
	quoted := make([]string, len(services))
	for i, s := range services {
		quoted[i] = regexp.QuoteMeta(s)
	}
	selector := strings.Join(quoted, "|")
	now := time.Now()
	fresh := map[string]Signal{}
	for _, spec := range signalSpecs {
		ctx, cancel := context.WithTimeout(context.Background(), signalTimeout)
		bySvc, err := d.queryRange(ctx, fmt.Sprintf(spec.query, selector), now)
		cancel()
		if err != nil {
			if !d.failing {
				slog.Error("dash0 signals unavailable", "err", err)
			}
			d.failing = true
			return
		}
		for svc, series := range bySvc {
			if !slices.Contains(services, svc) || len(series) == 0 {
				continue
			}
			v := series[len(series)-1]
			fresh[signalKey(svc, spec.key)] = Signal{
				Label: svc + " " + spec.label, Service: svc, Value: fmt.Sprintf(spec.format, v),
				Status: spec.status(v), Series: series, Spark: spark(series),
			}
		}
	}
	if d.failing {
		slog.Info("dash0 signals back")
		d.failing = false
	}

	inc.mu.Lock()
	var changed []Event
	for key, s := range fresh {
		was := "ok"
		if prev, ok := inc.signals[key]; ok {
			was = prev.Status
		}
		if s.Status != was {
			owner, _ := inc.roster.owner(s.Service)
			changed = append(changed, Event{Actor: "dash0", Team: owner.ID, Type: "signal",
				Text: fmt.Sprintf("%s is %s at %s (was %s)", s.Label, s.Status, s.Value, was)})
		}
	}
	inc.signals = fresh
	inc.mu.Unlock()

	slices.SortFunc(changed, func(a, b Event) int { return strings.Compare(a.Text, b.Text) })
	for _, ev := range changed {
		inc.append(ev)
	}
	if len(changed) == 0 {
		inc.broadcast()
	}
}
