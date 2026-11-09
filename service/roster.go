package main

import (
	"fmt"
	"os"
	"slices"

	"gopkg.in/yaml.v3"
)

type Team struct {
	ID      string   `yaml:"id" json:"id"`
	Name    string   `yaml:"name" json:"name"`
	Manager string   `yaml:"manager" json:"manager"`
	Members []string `yaml:"members" json:"members"`
	Owns    []string `yaml:"owns" json:"owns"`
}

type Repo struct {
	Repo  string   `yaml:"repo" json:"repo"`
	Paths []string `yaml:"paths" json:"paths"`
}

type Roster struct {
	Teams    []Team          `yaml:"teams"`
	Services map[string]Repo `yaml:"services"`
}

func loadRoster(path string) (Roster, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return Roster{}, fmt.Errorf("read %s: %w", path, err)
	}
	var r Roster
	if err := yaml.Unmarshal(b, &r); err != nil {
		return Roster{}, fmt.Errorf("parse %s: %w", path, err)
	}
	return r, nil
}

func (r Roster) teamOf(actor string) (Team, bool) {
	if actor == "" {
		return Team{}, false
	}
	for _, t := range r.Teams {
		if t.Manager == actor {
			return t, true
		}
		for _, m := range t.Members {
			if m == actor {
				return t, true
			}
		}
	}
	return Team{}, false
}

func (r Roster) known(logins []string, exclude string) []string {
	var out []string
	for _, l := range logins {
		if _, ok := r.teamOf(l); ok && l != exclude && !slices.Contains(out, l) {
			out = append(out, l)
		}
	}
	return out
}
