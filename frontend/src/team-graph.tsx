import { useCallback, useEffect, useMemo, useState } from "react";
import { Network, RotateCcw } from "lucide-react";
import {
  Background, BackgroundVariant, Controls, EdgeLabelRenderer, Handle, MarkerType, MiniMap,
  Position, ReactFlow, getBezierPath, useNodesInitialized, useNodesState, useReactFlow,
} from "@xyflow/react";
import type { Edge, EdgeProps, Node, NodeProps } from "@xyflow/react";
import type { ElkNode } from "elkjs/lib/elk.bundled.js";
import { Avatar, Button, plural } from "./ui";
import type { GraphLink, GraphMeans, GraphNode, TeamGraph } from "./service-client";
import "@xyflow/react/dist/style.css";
import "./team-graph.css";

type ArcMeans = Extract<GraphMeans, "depends_on" | "messaged" | "shared_incident">;
type CanvasNode = Node<{
  node: GraphNode;
  children: GraphNode[];
  state?: string;
  selected?: boolean;
  select?: (id: string) => void;
  hover?: (id: string) => void;
}, GraphNode["kind"]>;
type ArcEdge = Edge<{ link: GraphLink & { means: ArcMeans } }, "arc">;

export const arcLayers: { means: ArcMeans; label: string; caption: string }[] = [
  { means: "depends_on", label: "Depends on", caption: "Worked on a service another team owns" },
  { means: "messaged", label: "Messaged", caption: "Asks, replies and relays across teams" },
  { means: "shared_incident", label: "Shared incident", caption: "Both teams pulled into the incident" },
];

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

function OrgNode({ data }: NodeProps<CanvasNode>) {
  return (
    <div className="cm-graph-org">
      <span className="cm-graph-org-mark" aria-hidden="true"><Network size={16} /></span>
      <span>
        <strong>CaptainMorgue</strong>
        <small>{data.node.child_count} {plural(data.node.child_count, "team", "teams")}</small>
      </span>
      <Handle className="cm-graph-handle" type="source" position={Position.Bottom} id="tree-out" />
    </div>
  );
}

function TeamNode({ data }: NodeProps<CanvasNode>) {
  const team = data.node;
  return (
    <div className={`cm-graph-team${data.state || ""}`}>
      <Handle className="cm-graph-handle" type="target" position={Position.Top} id="tree-in" />
      <Handle className="cm-graph-handle" type="source" position={Position.Bottom} id="tree-out" />
      {arcLayers.map((layer, index) => (
        <span key={layer.means}>
          <Handle className="cm-graph-handle" type="source" position={Position.Bottom}
            id={`${layer.means}-out`} style={{ left: `${35 + index * 15}%` }} />
          <Handle className="cm-graph-handle" type="target" position={Position.Bottom}
            id={`${layer.means}-in`} style={{ left: `${35 + index * 15}%` }} />
        </span>
      ))}
      <button type="button" className={`cm-graph-team-header nodrag${data.state || ""}`}
        aria-pressed={data.selected} title={team.name}
        onFocus={() => data.hover?.(team.id)} onBlur={() => data.hover?.("")}
        onClick={(event) => { event.stopPropagation(); data.select?.(team.id); }}>
        <span className="cm-graph-team-heading">
          <strong>{team.name}</strong>
          <span className="cm-graph-team-status">
            <span className={`cm-status-dot ${statusDot(team.status)}`} aria-hidden="true" />
            {team.status === "pulled_in" ? "In the incident" : "Standing by"}
          </span>
        </span>
        <small title={team.manager}>{team.manager ? `Managed by ${team.manager}` : "No manager yet"}</small>
        <span className="cm-graph-team-summary">{data.children.map((child) => child.name).join(", ")}</span>
      </button>
    </div>
  );
}

function PersonNode({ data }: NodeProps<CanvasNode>) {
  return (
    <div className="cm-graph-person" aria-label={`${data.node.name}, ${data.node.status || "offline"}`}>
      <Avatar small name={data.node.name} />
      <span>{data.node.name}</span>
      <span className={`cm-status-dot ${statusDot(data.node.status)}`} aria-hidden="true" />
    </div>
  );
}

function ServiceNode({ data }: NodeProps<CanvasNode>) {
  return <div className="cm-graph-service" title={data.node.name}>{data.node.name}</div>;
}

function RelationshipEdge({ id, sourceX, sourceY, targetX, targetY, markerEnd, data }: EdgeProps<ArcEdge>) {
  if (!data) return null;
  const { link } = data;
  const lift = { depends_on: 24, messaged: 44, shared_incident: 64 }[link.means];
  const labelShift = { depends_on: -110, messaged: 0, shared_incident: 110 }[link.means];
  const direction = targetX >= sourceX ? 1 : -1;
  const startX = sourceX + direction * 24;
  const endX = targetX - direction * 24;
  const [curve, labelX, labelY] = getBezierPath({
    sourceX: startX, sourceY: sourceY + lift,
    sourcePosition: direction > 0 ? Position.Right : Position.Left,
    targetX: endX, targetY: targetY + lift,
    targetPosition: direction > 0 ? Position.Left : Position.Right,
    curvature: 0.4,
  });
  const path = `M ${sourceX} ${sourceY} Q ${sourceX} ${sourceY + lift} ${startX} ${sourceY + lift} ${curve.slice(curve.indexOf("C"))} Q ${targetX} ${targetY + lift} ${targetX} ${targetY}`;
  return (
    <g className={`cm-graph-arc is-${link.means}`}>
      <path id={id} d={path} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div className="cm-graph-arc-label" style={{ transform: `translate(-50%, -100%) translate(${labelX + labelShift}px, ${labelY + 18}px)` }}>
          {arcLayers.find((layer) => layer.means === link.means)?.label}{link.count > 1 ? ` x${link.count}` : ""}
        </div>
      </EdgeLabelRenderer>
    </g>
  );
}

const nodeTypes = { org: OrgNode, team: TeamNode, person: PersonNode, service: ServiceNode };
const edgeTypes = { arc: RelationshipEdge };

function FitGraph({ layout, duration }: { layout: CanvasNode[]; duration: number }) {
  const initialized = useNodesInitialized();
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (!initialized || !layout.length) return;
    const frame = requestAnimationFrame(() => { void fitView({ padding: 0.3, duration, maxZoom: 1 }); });
    return () => cancelAnimationFrame(frame);
  }, [initialized, layout, fitView, duration]);
  return null;
}

function treeEdges(graph?: TeamGraph): Edge[] {
  if (!graph) return [];
  const ids = new Set(graph.nodes.map((node) => node.id));
  const edges = new Map<string, Edge>();
  const add = (parent: string, child: string) => {
    if (!ids.has(parent) || !ids.has(child)) return;
    const id = `tree:${parent}:${child}`;
    edges.set(id, {
      id, source: parent, target: child, sourceHandle: "tree-out", targetHandle: "tree-in",
      type: "smoothstep", className: "cm-graph-tree", animated: false, selectable: false,
    });
  };
  for (const node of graph.nodes) {
    if (node.kind === "team" && node.parent_id) add(node.parent_id, node.id);
  }
  for (const link of graph.links) {
    if (link.means === "part_of") add(link.b, link.a);
  }
  return [...edges.values()];
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
  const [positioned, setPositioned, onNodesChange] = useNodesState<CanvasNode>([]);
  const [layout, setLayout] = useState<CanvasNode[]>([]);
  const [layoutError, setLayoutError] = useState("");
  const [layoutAttempt, setLayoutAttempt] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const tree = useMemo(() => treeEdges(graph), [graph]);
  const nodes = graph?.nodes || [];
  const teams = nodes.filter((node) => node.kind === "team");
  const arcs = (graph?.links || []).filter(isArc).filter((link) => layers[link.means]);
  const focus = hovered || selected;
  const focusTeam = teams.find((team) => team.id === focus);
  const focusArcs = focus ? arcs.filter((link) => link.a === focus || link.b === focus) : [];
  const related = new Set(focusArcs.flatMap((link) => [link.a, link.b]));
  const select = useCallback((id: string) => setSelected((current) => current === id ? "" : id), []);

  useEffect(() => writeFocus(selected), [selected]);
  useEffect(() => {
    const restoreFocus = () => { setSelected(readFocus()); setHovered(""); };
    window.addEventListener("popstate", restoreFocus);
    return () => window.removeEventListener("popstate", restoreFocus);
  }, []);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLayoutError("");
    if (!graph) {
      setPositioned([]);
      setLayout([]);
      return;
    }
    const byId = new Map(graph.nodes.map((node) => [node.id, node]));
    const children = new Map<string, GraphNode[]>();
    for (const node of graph.nodes) {
      if (node.parent_id) children.set(node.parent_id, [...(children.get(node.parent_id) || []), node]);
    }
    const build = (node: GraphNode): ElkNode => {
      if (node.kind !== "team") return { id: node.id, width: node.kind === "org" ? 220 : 288, height: node.kind === "org" ? 52 : node.kind === "person" ? 40 : 28 };
      const members = children.get(node.id) || [];
      return {
        id: node.id,
        ...(!members.length ? { width: 320, height: 88 } : {}),
        layoutOptions: {
          "elk.algorithm": "layered", "elk.direction": "DOWN",
          "elk.padding": "[top=48,left=16,bottom=16,right=16]",
          "elk.spacing.nodeNode": "24", "elk.layered.spacing.nodeNodeBetweenLayers": "24",
        },
        children: members.map(build),
        edges: members.slice(1).map((member, index) => ({
          id: `order:${node.id}:${index}`, sources: [members[index].id], targets: [member.id],
        })),
      };
    };
    const roots = graph.nodes.filter((node) => !node.parent_id || byId.get(node.parent_id)?.kind !== "team");
    const rootIds = new Set(roots.map((node) => node.id));
    async function arrange() {
      const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
      const result = await new ELK().layout({
        id: "root",
        layoutOptions: {
          "elk.algorithm": "layered", "elk.direction": "DOWN", "elk.hierarchyHandling": "INCLUDE_CHILDREN",
          "elk.spacing.nodeNode": "24", "elk.layered.spacing.nodeNodeBetweenLayers": "64",
          "elk.padding": "[top=112,left=24,bottom=24,right=24]",
        },
        children: roots.map(build),
        edges: tree.filter((edge) => rootIds.has(edge.source) && rootIds.has(edge.target))
          .map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
      });
      if (cancelled) return;
      const next: CanvasNode[] = [];
      const flatten = (item: ElkNode, parentId?: string) => {
        const node = byId.get(item.id)!;
        next.push({
          id: item.id, type: node.kind, position: { x: item.x || 0, y: item.y || 0 },
          ...(parentId ? { parentId, extent: "parent" as const } : {}),
          style: { width: item.width, height: item.height },
          data: { node, children: children.get(item.id) || [] },
          ariaRole: "group", ariaLabel: `${node.name}${node.status ? `, ${node.status}` : ""}`,
          selectable: false, focusable: false,
        });
        item.children?.forEach((child) => flatten(child, item.id));
      };
      result.children?.forEach((child) => flatten(child));
      setPositioned(next);
      setLayout(next);
    }
    void arrange().catch(() => {
      if (!cancelled) setLayoutError("The team graph could not be laid out.");
    });
    return () => { cancelled = true; };
  }, [graph, tree, layoutAttempt, setPositioned]);

  const canvasNodes = positioned.map((node) => {
    const teamId = node.type === "team" ? node.id : node.parentId;
    const faded = !!focusTeam && !!teamId && teamId !== focus && !related.has(teamId);
    const state = `${node.id === selected ? " is-selected" : ""}${faded ? " is-faded" : ""}`;
    return { ...node, className: state.trim(), data: { ...node.data, state, selected: node.id === selected, select, hover: setHovered } };
  });
  const edges: Edge[] = [...tree, ...focusArcs.map((link, index): ArcEdge => ({
    id: `arc:${link.a}:${link.b}:${link.means}:${index}`, source: link.a, target: link.b,
    sourceHandle: `${link.means}-out`, targetHandle: `${link.means}-in`, type: "arc",
    data: { link }, animated: false, selectable: false, zIndex: 10,
    ...(link.means === "depends_on" ? { markerEnd: { type: MarkerType.ArrowClosed, color: "var(--cm-text-strong)" } } : {}),
  }))];

  if (error || layoutError) {
    return (
      <div className="cm-graph-state" role="alert">
        <span className="cm-empty-icon" aria-hidden="true"><Network size={20} /></span>
        <p>{error || layoutError}</p>
        {(onRetry || layoutError) && (
          <Button onClick={layoutError ? () => setLayoutAttempt((current) => current + 1) : onRetry}>
            <RotateCcw size={15} />Try again
          </Button>
        )}
      </div>
    );
  }
  if (!graph) {
    return (
      <div className="cm-graph-state" role="status">
        <span className="cm-empty-icon" aria-hidden="true"><Network size={20} /></span>
        <p>{loading ? "Loading the team graph" : "No team graph yet."}</p>
      </div>
    );
  }

  const describe = (id: string) => teams.find((team) => team.id === id)?.name || id;
  const duration = reducedMotion ? 0 : 200;

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
        <div className="cm-graph-canvas">
          <ReactFlow<CanvasNode> nodes={canvasNodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
            onNodesChange={onNodesChange} colorMode="system" fitView
            fitViewOptions={{ padding: 0.3, duration, maxZoom: 1 }} minZoom={0.1} maxZoom={2}
            nodesConnectable={false} nodesFocusable={false} edgesFocusable={false} elementsSelectable={false}
            onNodeMouseEnter={(_, node) => setHovered(node.type === "team" ? node.id : node.parentId || "")}
            onNodeMouseLeave={() => setHovered("")}
            onNodeClick={(_, node) => { if (node.type === "team") select(node.id); }}
            onPaneClick={() => { setSelected(""); setHovered(""); }}>
            <Background variant={BackgroundVariant.Dots} color="var(--cm-stroke-strong)" gap={20} size={1} />
            <Controls showInteractive={false} fitViewOptions={{ padding: 0.3, duration, maxZoom: 1 }} />
            <MiniMap position="top-right" style={{ width: 140, height: 90 }} pannable zoomable nodeColor="var(--cm-bg-subtle)" nodeStrokeColor="var(--cm-stroke-mild)"
              maskColor="color-mix(in srgb, var(--cm-bg-layer) 75%, transparent)" />
            <FitGraph layout={layout} duration={duration} />
          </ReactFlow>
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
