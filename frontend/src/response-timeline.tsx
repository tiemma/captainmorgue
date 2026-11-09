import { useId } from "react";
import { Check } from "lucide-react";
import "./response-timeline.css";

const responseSteps = [
  {
    time: "14:44",
    title: "Emmanuel aborted the check-in canary",
    detail: "Previous version v1.7 restored while the crew investigated.",
  },
  {
    time: "14:45",
    title: "Sammy held the database restart",
    detail: "Sessions continued draining during the rollback.",
  },
  {
    time: "14:46",
    title: "Database pressure eased",
    detail: "Payment errors returned to 0.3%. The crew requested a real payment verification.",
  },
];

export function ResponseTimeline({ resolved }: { resolved: boolean }) {
  const headingId = useId();
  const steps = resolved
    ? [
        ...responseSteps,
        {
          time: "14:51",
          title: "The sample incident was closed",
          detail: "This is a design example, not a production incident record.",
        },
      ]
    : responseSteps;

  return (
    <section className="cm-record-section cm-response-timeline" aria-labelledby={headingId}>
      <span className="cm-section-number">02</span>
      <div className="cm-response-content">
        <div className="cm-response-heading">
          <h3 id={headingId} className="text-label-sm">Timeline</h3>
          <span className={`cm-response-state text-label-xs ${resolved ? "is-closed" : "is-active"}`}>
            {resolved ? (
              <Check size={13} aria-hidden="true" />
            ) : (
              <span className="cm-response-active-dot" aria-hidden="true" />
            )}
            {resolved ? "Closed" : "Active"}
          </span>
        </div>
        <ol className="cm-response-steps">
          {steps.map((step) => (
            <li className="cm-response-step" key={step.time}>
              <time className="cm-response-time text-paragraph-xs" dateTime={step.time}>{step.time}</time>
              <span className="cm-response-marker" aria-hidden="true" />
              <div className="cm-response-description">
                <h4 className="text-label-sm">{step.title}</h4>
                <p className="text-paragraph-sm">{step.detail}</p>
              </div>
            </li>
          ))}
          {!resolved && (
            <li className="cm-response-step is-pending">
              <span className="cm-response-time text-paragraph-xs">Next</span>
              <span className="cm-response-marker" aria-hidden="true" />
              <div className="cm-response-description">
                <h4 className="text-label-sm">Awaiting payment verification</h4>
                <p className="text-paragraph-sm">The incident remains open until the crew verifies recovery.</p>
              </div>
            </li>
          )}
        </ol>
      </div>
    </section>
  );
}
