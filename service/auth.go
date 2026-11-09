package main

import (
	"crypto/subtle"
	"net/http"
	"os"
	"strings"
)

func requireToken(next http.Handler) http.Handler {
	token := os.Getenv("CM_TOKEN")
	if token == "" {
		return next
	}
	want := []byte("Bearer " + token)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		open := r.Method == http.MethodGet && !strings.HasPrefix(r.URL.Path, "/inbox/")
		if !open && subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), want) != 1 {
			http.Error(w, "missing or wrong team token", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
