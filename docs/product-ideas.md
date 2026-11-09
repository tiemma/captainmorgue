# CaptainMorgue product ideas

Ranked by demo impact today, then production value.

## Landscape

| Product | What it does for coordination | Gap |
|---|---|---|
| incident.io | Slack channel as source of truth, Scribe call notes, catch-up for late joiners, Investigations that only open PRs ([docs](https://docs.incident.io/investigations/trust-and-safety)) | Coordinates humans in chat; nothing sees what responders' own coding agents run |
| Rootly | Agents per stage, AI SRE with confidence-scored RCA, handoff summary over MCP ([rootly.com/agents](https://rootly.com/agents)) | Rule-driven workflows; no action-level conflict detection |
| FireHydrant (Freshworks) | Runbooks, roles, status pages, AI retros on Enterprise only | AI is documentation, not coordination |
| PagerDuty | Scribe, Shift, SRE Agent; Paige plus a console showing "which agents are enabled and what they're doing" (GA 2026-11-03, [BusinessWire](https://www.businesswire.com/news/home/20261103256294/en/)) | Its own agents only; not humans' Claude Code sessions |
| Datadog Bits, Resolve, Cleric, Traversal | Autonomous investigation; Resolve lets you set action guardrails ([resolve.ai](https://resolve.ai/product/ai-sre)) | Single agent investigating; no multi-actor ordering or arbitration |
| Claude Code agent teams | Lead, shared task list, file-locked claims, mailboxes ([docs](https://code.claude.com/docs/en/agent-teams)) | One machine, one person, experimental |
| dibs, agent-semaphore, Coordinaut | File leases, PreToolUse deny with holder named ([dibs](https://github.com/polymatx/dibs)) | Repo files on one machine; "cross-machine live coordination is on the roadmap" |
| A2A | Agent cards, task states incl. input-required, rejected ([spec](https://a2a-protocol.org/latest/specification/)) | Transport only; no ordering, authority or conflict model |

The open gap: nobody coordinates many humans' coding agents acting on the same cluster during one incident. Code-repo lease tools prove the pattern; incident tools stop at chat.

## Ideas

**1. Announce-and-claim before any cluster write (TOP 3).** PreToolUse hook parses kubectl/helm/Radar MCP writes, POSTs an intent, gets a lease on `ns/kind/name`; a second agent's write is denied with "held by Dev (rollback checkout), term 2, ask via @dev". Why: practitioners' first rule is "one person changes production at a time, every change announced before it happens" ([sysroot](https://sysroot.io/blog/incident-response-for-small-teams)); deny text that names the holder makes Claude reroute on its own ([dibs blog](https://polymatx.dev/blog/posts/dibs-coordination-for-parallel-coding-agents/)). Needs: existing conflict rule, sequencer, hooks. Size: 1.5 h. Fits today: yes.

**2. Manager approval for destructive actions (TOP 3).** Hook classifies delete, scale-to-0, rollback, `--force`; blocks and sends an `approve` ask to the team manager, stamped with term; answer returns via inbox. Why: repeated agent disasters came from self-authorized irreversible actions ([Claude Code #89014](https://github.com/anthropics/claude-code/issues/89014), [Replit postmortem](https://swarmproof.github.io/agent-postmortems/2025-replit-prod-db-deletion/)); "a correct diagnosis is not a mandate". Needs: elections/terms, inbox, escalation. Size: 1.5-2 h. Fits: yes if inbox lands.

**3. Join catch-up digest (TOP 3).** On `/captainmorgue:join` or long-cursor return, Claude summarises the record since your cursor: open leases, who owns what, last 3 actions, the one thing asked of you. Why: incident.io ships catch-up for joiners; "the status tax" drains the most informed engineer ([dev.to](https://dev.to/ginocorp_industries/the-first-ten-minutes-of-an-outage-are-a-coordination-problem-1o1c)). Needs: ES record, Claude relay, SessionStart hook. Size: 1 h. Fits: yes.

**4. Unrecorded-change detector.** Diff Radar `get_changes` against recorded actions; any cluster change without a matching seq is flagged "someone outside the desk changed X". Why: "unobserved changes... you are now debugging your own team" (dev.to above). Needs: CaptainMorgue's own read-only Radar connection (5a). Size: 2 h. Fits: stretch.

**5. "What fixed it" attribution.** At close, line each action seq against Dash0 error rate; the record names the action after which the metric recovered, and flags overlapping actions as ambiguous. Why: two mitigations in one minute means "nobody knows which change did it" (dev.to above). Needs: Dash0 read, record writer. Size: 2 h. Fits: stretch.

**6. Recall on open.** When Dash0 opens an incident, query ES for similar past records and push "last time: rolled back confdb pool change" to the manager. Why: Rootly's `suggest_solutions` and incident.io both lean on history ([chatforest](https://chatforest.com/reviews/sre-incident-management-mcp-servers/)). Needs: ES, router. Size: 1 h. Fits: yes, if ES has seed records.

**7. Attendee status page.** Auto-draft public updates from the record at each state change; manager approves. Why: without a comms role "four people post four contradicting updates" ([command vacuum](https://devopsaitoolkit.com/blog/incident-response-command-vacuum/)). Needs: record, wall screen route. Size: 1 h. Fits: maybe.

**8. Route the fix to the agent that shipped it.** Gitar knows the PR author; when Dash0 ties the regression to a deploy, send that person's agent the evidence as an ask. Why: ControlTheory pitches handing cause to "the coding agent that shipped the change" ([controltheory](https://www.controltheory.com/compare/ai-sre-tools/)). Needs: Gitar, router. Size: 1.5 h. Fits: no (post-demo).

**9. Per-actor attribution in the cluster.** Hooks stamp `captainmorgue.io/seq` and actor into the User-Agent or annotations, so the K8s audit log answers "which agent, whose instruction". Why: shared kubeconfigs make attribution unrecoverable later ([Qovery](https://www.qovery.com/blog/ai-agents-kubernetes-audit-trails-policy-guardrails)). Needs: hooks. Size: 1 h. Fits: no, low demo value.

**10. Admission webhook enforcement.** Move leases and approvals from advisory hooks into a ValidatingWebhook so non-plugin actors are also stopped. Why: "guardrails belong at admission, not in the prompt" (Qovery). Needs: cluster RBAC, failure policy design. Size: 6 h+. Fits: no; the production story.

**11. A2A agent cards and task states.** Publish a card per responder (skills = team, resources owned) and map asks to A2A states (input-required, rejected). Why: PagerDuty is shipping agent-to-agent ([spring release](https://www.pagerduty.com/newsroom/pagerduty-operations-cloud-spring-2026-release/)). Size: 3 h. Fits: no; pitch slide only.

## Top 3 for today

1. Announce-and-claim lease with PreToolUse deny (idea 1).
2. Manager approval for destructive actions (idea 2).
3. Join catch-up digest (idea 3).

Pitch line: incident tools coordinate people in chat, and lease tools coordinate agents on one laptop. CaptainMorgue coordinates everyone's agents on one cluster.
