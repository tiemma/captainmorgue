package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/elastic/go-elasticsearch/v9"
	"github.com/elastic/go-elasticsearch/v9/typedapi/types"
	"github.com/elastic/go-elasticsearch/v9/typedapi/types/enums/sortorder"
)

const (
	eventsIndex  = "cm-events"
	recordsIndex = "cm-records"
	esTimeout    = 10 * time.Second
)

type store struct {
	es     *elasticsearch.TypedClient
	writes chan Event
}

type PastMatch struct {
	ID      string `json:"id"`
	Summary string `json:"summary"`
	FixedBy string `json:"fixed_by"`
}

type storedRecord struct {
	PastMatch
	Title        string        `json:"title"`
	Status       string        `json:"status"`
	Severity     string        `json:"severity,omitempty"`
	Duration     string        `json:"duration,omitempty"`
	Opened       *time.Time    `json:"opened,omitempty"`
	Resolved     *time.Time    `json:"resolved,omitempty"`
	Parts        []RecordPart  `json:"parts"`
	Improvements []Improvement `json:"improvements"`
	RFO          *Record       `json:"rfo,omitempty"`
}

type RecordSummary struct {
	ID       string     `json:"id"`
	Title    string     `json:"title"`
	Status   string     `json:"status"`
	Severity string     `json:"severity"`
	Opened   *time.Time `json:"opened"`
	Resolved *time.Time `json:"resolved"`
	Duration string     `json:"duration"`
	Summary  string     `json:"summary"`
	FixedBy  string     `json:"fixed_by"`
}

func newStore(ctx context.Context) (*store, error) {
	url, key := os.Getenv("ELASTIC_URL"), os.Getenv("ELASTIC_API_KEY")
	if url == "" || key == "" {
		return nil, nil
	}
	es, err := elasticsearch.NewTypedClient(elasticsearch.Config{Addresses: []string{url}, APIKey: key})
	if err != nil {
		return nil, fmt.Errorf("elasticsearch client: %w", err)
	}
	s := &store{es: es, writes: make(chan Event, 1024)}
	if err := s.ensureIndex(ctx, eventsIndex, eventsMapping()); err != nil {
		return nil, err
	}
	if err := s.ensureIndex(ctx, recordsIndex, recordsMapping()); err != nil {
		return nil, err
	}
	if _, err := s.es.Indices.PutMapping(recordsIndex).Properties(rfoMapping()).Do(ctx); err != nil {
		return nil, fmt.Errorf("update %s mapping: %w", recordsIndex, err)
	}
	return s, nil
}

func openStore(ctx context.Context) (*store, []Event, []Record, error) {
	s, err := newStore(ctx)
	if err != nil || s == nil {
		return nil, nil, nil, err
	}
	events, err := s.loadEvents(ctx)
	if err != nil {
		return nil, nil, nil, err
	}
	records, err := s.listRecords(ctx)
	if err != nil {
		return nil, nil, nil, err
	}
	go s.writeLoop()
	return s, events, records, nil
}

func keyword() types.Property { return types.NewKeywordProperty() }

func copiedText(to string) types.Property {
	return &types.TextProperty{CopyTo: []string{to}}
}

func eventsMapping() *types.TypeMapping {
	return &types.TypeMapping{Properties: map[string]types.Property{
		"id":            keyword(),
		"incident_id":   keyword(),
		"seq":           types.NewLongNumberProperty(),
		"ts":            types.NewDateProperty(),
		"actor":         keyword(),
		"team":          keyword(),
		"type":          keyword(),
		"text":          copiedText("text_semantic"),
		"text_semantic": types.NewSemanticTextProperty(),
		"resource": &types.ObjectProperty{Properties: map[string]types.Property{
			"kind": keyword(), "namespace": keyword(), "name": keyword(),
		}},
		"artifacts": &types.NestedProperty{Properties: map[string]types.Property{
			"label": types.NewTextProperty(), "url": keyword(),
		}},
		"to":  keyword(),
		"why": types.NewTextProperty(),
	}}
}

func recordsMapping() *types.TypeMapping {
	return &types.TypeMapping{Properties: map[string]types.Property{
		"id":               keyword(),
		"title":            types.NewTextProperty(),
		"summary":          copiedText("summary_semantic"),
		"summary_semantic": types.NewSemanticTextProperty(),
		"fixed_by":         keyword(),
		"opened":           types.NewDateProperty(),
		"resolved":         types.NewDateProperty(),
		"parts": &types.NestedProperty{Properties: map[string]types.Property{
			"name": types.NewTextProperty(), "how": types.NewTextProperty(),
		}},
		"improvements": &types.NestedProperty{Properties: map[string]types.Property{
			"text": types.NewTextProperty(), "owner": keyword(), "link": keyword(),
		}},
	}}
}

func rfoMapping() map[string]types.Property {
	return map[string]types.Property{
		"status":   keyword(),
		"severity": keyword(),
		"duration": keyword(),
		"rfo":      &types.ObjectProperty{Enabled: new(false)},
	}
}

func (s *store) listRecords(ctx context.Context) ([]Record, error) {
	res, err := s.es.Search().Index(recordsIndex).
		Sort(&types.SortOptions{SortOptions: map[string]types.FieldSort{"opened": {Order: &sortorder.Desc}}}).
		Size(100).
		Do(ctx)
	if err != nil {
		return nil, fmt.Errorf("list records: %w", err)
	}
	out := make([]Record, 0, len(res.Hits.Hits))
	for _, hit := range res.Hits.Hits {
		var rec storedRecord
		if err := json.Unmarshal(hit.Source_, &rec); err != nil {
			return nil, fmt.Errorf("decode record: %w", err)
		}
		if rec.RFO != nil {
			out = append(out, *rec.RFO)
		}
	}
	return out, nil
}

func (s *store) getRecord(ctx context.Context, id string) (*Record, error) {
	res, err := s.es.Get(recordsIndex, id).Do(ctx)
	if err != nil {
		return nil, fmt.Errorf("get record %s: %w", id, err)
	}
	if !res.Found {
		return nil, nil
	}
	var rec storedRecord
	if err := json.Unmarshal(res.Source_, &rec); err != nil {
		return nil, fmt.Errorf("decode record %s: %w", id, err)
	}
	return rec.RFO, nil
}

func (s *store) ensureIndex(ctx context.Context, name string, mapping *types.TypeMapping) error {
	exists, err := s.es.Indices.Exists(name).IsSuccess(ctx)
	if err != nil {
		return fmt.Errorf("check index %s: %w", name, err)
	}
	if exists {
		return nil
	}
	if _, err := s.es.Indices.Create(name).Mappings(mapping).Do(ctx); err != nil {
		return fmt.Errorf("create index %s: %w", name, err)
	}
	slog.Info("created index", "index", name)
	return nil
}

func (s *store) saveRecord(ctx context.Context, rec Record) error {
	doc := storedRecord{
		PastMatch:    PastMatch{ID: rec.ID, Summary: rec.Summary, FixedBy: rec.FixedBy},
		Title:        rec.Title,
		Status:       rec.Status,
		Severity:     rec.Severity,
		Duration:     rec.Duration,
		Opened:       rec.Opened,
		Resolved:     rec.Resolved,
		Parts:        rec.Parts,
		Improvements: rec.ActionItems,
		RFO:          &rec,
	}
	if _, err := s.es.Index(recordsIndex).Id(rec.ID).Document(doc).Do(ctx); err != nil {
		return fmt.Errorf("index record %s: %w", rec.ID, err)
	}
	return nil
}

func (s *store) saveEvent(ev Event) {
	if s == nil {
		return
	}
	select {
	case s.writes <- ev:
	default:
		slog.Error("elasticsearch write queue full, dropping event", "id", ev.ID)
	}
}

func (s *store) writeLoop() {
	for ev := range s.writes {
		ctx, cancel := context.WithTimeout(context.Background(), esTimeout)
		if _, err := s.es.Index(eventsIndex).Id(ev.ID).Document(ev).Do(ctx); err != nil {
			slog.Error("index event", "id", ev.ID, "err", err)
		}
		cancel()
	}
}

func (s *store) loadEvents(ctx context.Context) ([]Event, error) {
	res, err := s.es.Search().Index(eventsIndex).
		Sort(&types.SortOptions{SortOptions: map[string]types.FieldSort{"seq": {Order: &sortorder.Asc}}}).
		Size(10000).
		Do(ctx)
	if err != nil {
		return nil, fmt.Errorf("load events: %w", err)
	}
	events := make([]Event, 0, len(res.Hits.Hits))
	for _, hit := range res.Hits.Hits {
		var ev Event
		if err := json.Unmarshal(hit.Source_, &ev); err != nil {
			return nil, fmt.Errorf("decode event: %w", err)
		}
		events = append(events, ev)
	}
	return events, nil
}

func (s *store) closestRecord(ctx context.Context, excludeID, text string) (*PastMatch, error) {
	standard := func(q types.Query) types.RetrieverContainer {
		return types.RetrieverContainer{Standard: &types.StandardRetriever{Query: &q}}
	}
	res, err := s.es.Search().Index(recordsIndex).
		Retriever(&types.RetrieverContainer{Rrf: &types.RRFRetriever{
			Retrievers: []types.RRFRetrieverEntry{
				standard(types.Query{Match: map[string]types.MatchQuery{"summary": {Query: text}}}),
				standard(types.Query{Semantic: &types.SemanticQuery{Field: "summary_semantic", Query: text}}),
			},
			Filter: []types.Query{{Bool: &types.BoolQuery{MustNot: []types.Query{{Ids: &types.IdsQuery{Values: []string{excludeID}}}}}}},
		}}).
		Size(1).
		Do(ctx)
	if err != nil {
		return nil, fmt.Errorf("search records: %w", err)
	}
	if len(res.Hits.Hits) == 0 {
		return nil, nil
	}
	var m PastMatch
	if err := json.Unmarshal(res.Hits.Hits[0].Source_, &m); err != nil {
		return nil, fmt.Errorf("decode record: %w", err)
	}
	return &m, nil
}
