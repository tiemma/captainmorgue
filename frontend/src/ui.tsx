import { useEffect, useRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Check, Circle, LoaderCircle, Clock3, X } from "lucide-react";

export type Tone = "neutral" | "amber" | "danger" | "success" | "info";
export function Button({
  children,
  tone = "neutral",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      {...props}
      className={`cm-button text-label-sm cm-button-${tone} ${className}`}
    >
      {children}
    </button>
  );
}
export function Badge({
  children,
  tone = "neutral",
  dot = true,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
}) {
  return (
    <span className={`cm-badge text-label-xs cm-tone-${tone}`}>
      {dot && <span className="cm-status-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
export function Avatar({
  name,
  small = false,
}: {
  name: string;
  small?: boolean;
}) {
  return (
    <span
      className={`cm-avatar${small ? " cm-avatar-small" : ""}`}
      aria-label={name}
    >
      {name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`cm-panel ${className}`}>
      <div className="cm-panel-heading">
        <h2 className="text-label-sm">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="cm-empty">
      <span className="cm-empty-icon">
        <Circle size={26} />
      </span>
      <h2 className="text-title-h5">{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef(document.activeElement as HTMLElement | null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = opener.current;
    const input = ref.current?.querySelector<HTMLElement>("textarea, input");
    (input ?? ref.current)?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") close.current();
      if (event.key !== "Tab") return;
      const items = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, textarea, select, [tabindex="0"]',
        ) ?? [],
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === ref.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === ref.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="cm-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="cm-modal"
      >
        <div className="cm-panel-heading">
          <h2>{title}</h2>
          <Button aria-label="Close dialog" onClick={onClose}>
            <X size={17} />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Receipt({ children }: { children: ReactNode }) {
  return (
    <span className="cm-receipt">
      <Check size={13} />
      {children}
    </span>
  );
}

export function ProgressStatus({ state, children }: {
  state: "working" | "waiting" | "done";
  children: ReactNode;
}) {
  const StateIcon = state === "working" ? LoaderCircle : state === "waiting" ? Clock3 : Check;
  return (
    <span className={`cm-progress-status text-paragraph-xs cm-progress-${state}`} role="status">
      <StateIcon size={14} aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}
