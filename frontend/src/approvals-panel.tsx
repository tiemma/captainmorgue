import { useState } from "react";
import { Badge, Button, Panel } from "./ui";
import type { Tone } from "./ui";
import type { Approval } from "./service-client";

const tones: { [status in Approval["status"]]: Tone } = {
  pending: "amber",
  approved: "success",
  denied: "danger",
  expired: "neutral",
};

function time(value: string | null) {
  return value
    ? new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "";
}

export function ApprovalsPanel({
  approvals,
  identity,
  commander,
  busy,
  onDecide,
}: {
  approvals: Approval[];
  identity: string;
  commander?: string;
  busy: boolean;
  onDecide: (
    approval: Approval,
    decision: "approve" | "deny",
    why: string,
  ) => void;
}) {
  const [why, setWhy] = useState<{ [id: number]: string }>({});
  return (
    <Panel title="Approvals">
      {approvals.length ? (
        <ul className="cm-live-claims">
          {[...approvals].reverse().map((approval) => {
            const mayDecide =
              approval.status === "pending" &&
              !!identity &&
              (identity === approval.approver || identity === commander);
            return (
              <li key={approval.id}>
                <div>
                  <span className="text-label-sm">
                    #{approval.id} {approval.actor}
                  </span>
                  <Badge tone={tones[approval.status]}>{approval.status}</Badge>
                </div>
                <p className="text-paragraph-xs">{approval.action}</p>
                <p className="text-paragraph-sm">{approval.why}</p>
                <span className="text-paragraph-xs">
                  {approval.status === "pending"
                    ? `Waiting on ${approval.approver}, expires ${time(approval.expires)}`
                    : approval.decided_by
                      ? `${approval.decided_by} ${approval.status} at ${time(approval.decided)}${approval.note ? `: ${approval.note}` : ""}`
                      : `Expired at ${time(approval.expires)}`}
                </span>
                {mayDecide && (
                  <>
                    <input
                      aria-label={`Reason for approval ${approval.id}`}
                      placeholder="Why (optional)"
                      value={why[approval.id] || ""}
                      onChange={(event) =>
                        setWhy({ ...why, [approval.id]: event.target.value })
                      }
                    />
                    <div>
                      <Button
                        tone="amber"
                        disabled={busy}
                        onClick={() =>
                          onDecide(approval, "approve", why[approval.id] || "")
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        disabled={busy}
                        onClick={() =>
                          onDecide(approval, "deny", why[approval.id] || "")
                        }
                      >
                        Deny
                      </Button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="cm-live-empty text-paragraph-sm">
          No approvals requested.
        </p>
      )}
    </Panel>
  );
}
