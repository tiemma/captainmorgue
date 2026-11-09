package main

import "testing"

func TestCountOf(t *testing.T) {
	for n, want := range map[int]string{0: "0 events", 1: "1 event", 2: "2 events"} {
		if got := countOf(n, "event"); got != want {
			t.Errorf("countOf(%d) = %q, want %q", n, got, want)
		}
	}
}
