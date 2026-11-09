import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Network, RotateCcw } from "lucide-react";
import { Avatar, Button, plural } from "./ui";
import type { GraphLink, GraphMeans, GraphNode, TeamGraph } from "./service-client";
import "./team-graph.css";

type ArcMeans = Extract<GraphMeans, "depends_on" | "messaged" | "shared_incident">;
type Box = { x: number; y: number; w: number };

export const arcLayers: { means: ArcMeans; label: string; caption: string }[] = [
  { means: "depends_on", label: "Depends on", caption: "Worked on a service another team owns" },
  { means: "messaged", label: "Messaged", caption: "Asks, replies and relays across teams" },
  { means: "shared_incident", label: "Shared incident", caption: "Both teams pulled into the incident" },
];
const arcOffset: Record<ArcMeans, number> = { depends_on: -12, messaged: 0, shared_incident: 12 };
const arcLift: Record<ArcMeans, number> = { depends_on: 48, messaged: 88, shared_incident: 128 };

function isArc(link: GraphLink): link is GraphLink & { means: ArcMeans } {
  return arcLayers.some((layer) => layer.means === link.means);
}

function statusDot(status?: string) {
  if (status === "online" || status === "pulled_in") return "is-green";
  if (status === "suspect") return "is-warning";
  return "is-offline";
}

function readFocus() {
  try {
    return new URLSearchParams(window.location.search).get("focus") || "";
  } catch {
    return "";
  }
}

function writeFocus(id: string) {
  try {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("focus", id);
    else url.searchParams.delete("focus");
    window.history.replaceState(null, "", url);
  } catch {
    return;
  }
}

export function TeamGraphView({
  graph,
  loading = false,
  error,
  onRetry,
}: {
  graph?: TeamGraph;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  const [hovered, setHovered] = useState("");
  const [selected, setSelected] = useState(readFocus);
  const [layers, setLayers] = useState<Record<ArcMeans, boolean>>({
    depends_on: true,
    messaged: true,
    shared_incident: true,
  });
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const [size, setSize] = useState({ w: 0, h: 0 });
  const canvas = useRef<HTMLDivElement>(null);

  const nodes = graph?.nodes || [];
  const teams = nodes.filter((node) => node.kind === "team");
  const org = nodes.find((node) => node.kind === "org");
  const children = useMemo(() => {
    const map: Record<string, GraphNode[]> = {};
    for (const node of nodes) {
      if (node.parent_id) (map[node.parent_id] ||= []).push(node);
    }
    return map;
  }, [nodes]);
  const arcs = (graph?.links || []).filter(isArc).filter((link) => layers[link.means]);
  const focus = hovered || selected;
  const focusTeam = teams.find((team) => team.id === focus);
  const focusArcs = focus ? arcs.filter((link) => link.a === focus || link.b === focus) : [];
  const related = new Set(focusArcs.flatMap((link) => [link.a, link.b]));

  useEffect(() => writeFocus(selected), [selected]);

  useLayoutEffect(() => {
    const root = canvas.current;
    if (!root) return;
    function measure() {
      const frame = root!.getBoundingClientRect();
      const next: Record<string, Box> = {};
      root!.querySelectorAll<HTMLElement>("[data-node]").forEach((element) => {
        const rect = element.getBoundingClientRect();
        next[element.dataset.node!] = { x: rect.left - frame.left, y: rect.top - frame.top, w: rect.width };
      });
      setBoxes(next);
      setSize({ w: frame.width, h: frame.height });
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [graph]);

  if (error) {
    return (
      <div className="cm-graph-state" role="alert">
        <span className="cm-empty-icon" aria-hidden="true">
          <Network size={20} />
        </span>
        <p>{error}</p>
        {onRetry && (
          <Button onClick={onRetry}>
            <RotateCcw size={15} />
            Try again
          </Button>
        )}
      </div>
    );
  }
  if (!graph) {
    return (
      <div className="cm-graph-state" role="status">
        <span className="cm-empty-icon" aria-hidden="true">
          <Network size={20} />
        </span>
        <p>{loading ? "Loading the team graph" : "No team graph yet."}</p>
      </div>
    );
  }

  const orgBox = org && boxes[org.id];
  const busY = orgBox ? orgBox.y + 60 : 0;
  const describe = (id: string) => teams.find((team) => team.id === id)?.name || id;

  return (
    <div className="cm-graph">
      <div className="cm-graph-toolbar">
        <div className="cm-graph-layers" role="group" aria-label="Relationship layers">
          {arcLayers.map((layer) => (
            <button
              key={layer.means}
              type="button"
              className={`cm-graph-layer is-${layer.means}`}
              aria-pressed={layers[layer.means]}
              title={layer.caption}
              onClick={() => setLayers((current) => ({ ...current, [layer.means]: !current[layer.means] }))}
            >
              <svg width="20" height="8" aria-hidden="true">
                <line x1="1" y1="4" x2="19" y2="4" />
              </svg>
              {layer.label}
            </button>
          ))}
        </div>
        <span className="cm-graph-hint text-paragraph-xs">
          {focusTeam ? `Showing how ${focusTeam.name} relates` : "Hover or select a team to see how it relates"}
        </span>
      </div>
      <div className="cm-graph-layout">
        <div
          className={`cm-graph-canvas${focus ? " has-focus" : ""}`}
          ref={canvas}
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelected("");
          }}
        >
          <svg className="cm-graph-lines" width={size.w} height={size.h} aria-hidden="true">
            {orgBox &&
              teams.map((team) => {
                const box = boxes[team.id];
                if (!box) return null;
                const x = box.x + box.w / 2;
                return (
                  <path
                    key={team.id}
                    className="cm-graph-tree"
                    d={`M ${orgBox.x + orgBox.w / 2} ${orgBox.y + 44} V ${busY} H ${x} V ${box.y}`}
                  />
                );
              })}
            {focusArcs.map((link) => {
              const a = boxes[link.a];
              const b = boxes[link.b];
              if (!a || !b) return null;
              const ax = a.x + a.w / 2 + arcOffset[link.means];
              const bx = b.x + b.w / 2 + arcOffset[link.means];
              const lift = arcLift[link.means];
              const top = Math.min(a.y, b.y) - lift;
              const midX = (ax + bx) / 2;
              return (
                <g key={`${link.a}-${link.b}-${link.means}`} className={`cm-graph-arc is-${link.means}`}>
                  <path d={`M ${ax} ${a.y} C ${ax} ${top}, ${bx} ${top}, ${bx} ${b.y}`} />
                  {link.means === "depends_on" && <circle cx={bx} cy={b.y} r="3" />}
                  <text x={midX} y={Math.min(a.y, b.y) * 0.25 + top * 0.75 - 6} textAnchor="middle">
                    {arcLayers.find((layer) => layer.means === link.means)?.label} {link.count > 1 ? `x${link.count}` : ""}
                  </text>
                </g>
              );
            })}
          </svg>
          {org && (
            <div className="cm-graph-org" data-node={org.id}>
              <span className="cm-graph-org-mark" aria-hidden="true">
                <Network size={16} />
              </span>
              <span>
                <strong>{org.name}</strong>
                <small>
                  {org.child_count} {plural(org.child_count, "team", "teams")}
                </small>
              </span>
            </div>
          )}
          <div className="cm-graph-teams">
            {teams.map((team) => {
              const members = (children[team.id] || []).filter((node) => node.kind === "person");
              const services = (children[team.id] || []).filter((node) => node.kind === "service");
              const state =
                team.id === selected ? " is-selected" : focus && team.id !== focus && !related.has(team.id) ? " is-faded" : "";
              return (
                <button
                  type="button"
                  key={team.id}
                  data-node={team.id}
                  className={`cm-graph-team${state}`}
                  aria-pressed={team.id === selected}
                  onMouseEnter={() => setHovered(team.id)}
                  onMouseLeave={() => setHovered("")}
                  onFocus={() => setHovered(team.id)}
                  onBlur={() => setHovered("")}
                  onClick={() => setSelected((current) => (current === team.id ? "" : team.id))}
                >
                  <span className="cm-graph-team-heading">
                    <strong>{team.name}</strong>
                    <span className="cm-graph-team-status">
                      <span className={`cm-status-dot ${statusDot(team.status)}`} aria-hidden="true" />
                      {team.status === "pulled_in" ? "In the incident" : "Standing by"}
                    </span>
                  </span>
                  <small>{team.manager ? `Managed by ${team.manager}` : "No manager yet"}</small>
                  {members.length > 0 && (
                    <span className="cm-graph-people">
                      {members.map((person) => (
                        <span className="cm-graph-person" key={person.id}>
                          <Avatar small name={person.name} />
                          <span>{person.name}</span>
                          <span className={`cm-status-dot ${statusDot(person.status)}`} aria-hidden="true" />
                        </span>
                      ))}
                    </span>
                  )}
                  {services.length > 0 && (
                    <span className="cm-graph-services">
                      {services.map((service) => (
                        <span className="cm-graph-service" key={service.id}>
                          {service.name}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <aside className="cm-graph-inspector" aria-label="Team relationships">
          {focusTeam ? (
            <>
              <h2 className="text-label-md">{focusTeam.name}</h2>
              <p className="text-paragraph-xs">
                {focusTeam.manager ? `Managed by ${focusTeam.manager}` : "No manager yet"}
              </p>
              <h3 className="text-label-xs">Relationships</h3>
              {focusArcs.length ? (
                <ul className="cm-graph-links">
                  {focusArcs.map((link) => (
                    <li key={`${link.a}-${link.b}-${link.means}`}>
                      <span className={`cm-graph-swatch is-${link.means}`} aria-hidden="true" />
                      <span>
                        <strong>
                          {link.means === "depends_on"
                            ? `${describe(link.a)} depends on ${describe(link.b)}`
                            : `${arcLayers.find((layer) => layer.means === link.means)?.label} with ${describe(link.a === focusTeam.id ? link.b : link.a)}`}
                        </strong>
                        <small>
                          {link.count} {plural(link.count, "time", "times")} / {link.source}
                          {link.evidence.length > 0 && ` / ${link.evidence.join(", ")}`}
                        </small>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-paragraph-xs">No relationships in the visible layers.</p>
              )}
            </>
          ) : (
            <>
              <h2 className="text-label-md">How teams relate</h2>
              <p className="text-paragraph-xs">
                The team tree is the backbone. Arcs come from what CaptainMorgue saw in this incident: services a team
                worked on that another team owns, messages across teams, and teams pulled in together.
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
