package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"
)

func main() {
	roster, err := loadRoster(env("ROSTER", "roster.yaml"))
	if err != nil {
		slog.Error("load roster", "err", err)
		os.Exit(1)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	id := env("INCIDENT_ID", "INC-1")
	st, events, err := openStore(ctx, id)
	if err != nil {
		slog.Error("elasticsearch unavailable, keeping the incident in memory", "err", err)
	}
	br := newBrain()
	slog.Info("intelligence", "elasticsearch", st != nil, "claude", br != nil, "loaded_events", len(events))
	inc := newIncident(id, env("INCIDENT_TITLE", "Check-in kiosks failing at Hall B"), roster, st, br)
	inc.events = events
	if st != nil {
		go inc.matchLoop()
		inc.refreshPastMatch()
	}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /events", inc.handleEvent)
	mux.HandleFunc("POST /broadcast", inc.handleBroadcast)
	mux.HandleFunc("GET /stream", inc.handleStream)
	mux.HandleFunc("GET /record/{id}", inc.handleRecord)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	mux.Handle("GET /", http.FileServer(http.Dir(env("WEB_DIR", "web"))))

	addr := ":" + env("PORT", "8080")
	slog.Info("listening", "addr", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		slog.Error("serve", "err", err)
		os.Exit(1)
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
