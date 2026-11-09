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
	inc := newIncident(id, env("INCIDENT_TITLE", "Conference operations"), roster, st, br)
	inc.events = events
	if st != nil {
		go inc.matchLoop()
		inc.refreshPastMatch()
	}

	if err := inc.startCoord(); err != nil {
		slog.Error("coordination config", "err", err)
		os.Exit(1)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /events", inc.handleEvent)
	mux.HandleFunc("POST /broadcast", inc.handleBroadcast)
	mux.HandleFunc("GET /stream", inc.handleStream)
	mux.HandleFunc("GET /record/{id}", inc.handleRecord)
	mux.HandleFunc("POST /incidents/{id}/join", inc.handleJoin)
	mux.HandleFunc("POST /incidents/{id}/leave", inc.handleLeave)
	mux.HandleFunc("POST /incidents/{id}/vote", inc.handleVote)
	mux.HandleFunc("POST /incidents/{id}/task", inc.handleTask)
	mux.HandleFunc("POST /heartbeat", inc.handleHeartbeat)
	mux.HandleFunc("GET /inbox/{actor}", inc.handleInbox)
	mux.HandleFunc("POST /inbox/{actor}/ack", inc.handleAck)
	mux.HandleFunc("POST /messages", inc.handleMessages)
	mux.HandleFunc("POST /claims", inc.handleClaim)
	mux.HandleFunc("POST /alerts", inc.handleAlert)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	mux.Handle("GET /", http.FileServer(http.Dir(env("WEB_DIR", "web"))))

	addr := ":" + env("PORT", "8080")
	slog.Info("listening", "addr", addr)
	if err := http.ListenAndServe(addr, requireToken(mux)); err != nil {
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
