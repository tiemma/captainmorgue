import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { X } from "lucide-react";
import "./side-panel.css";

const storageKey = "captainmorgue.side-panel.width";
const clamp = (value: number) => Math.min(720, Math.max(360, value));

export function SidePanel({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [width, setWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey));
      return Number.isFinite(saved) && saved > 0 ? clamp(saved) : 420;
    } catch {
      return 420;
    }
  });
  const [available, setAvailable] = useState(1200);
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const heading = useId();
  const body = useId();
  const stacked = available < 800;
  const shownWidth = Math.min(width, Math.max(360, available - 400));
  close.current = onClose;

  useEffect(() => {
    const previous = document.activeElement;
    opener.current = previous instanceof HTMLElement ? previous : null;
    closeButton.current?.focus({ preventScroll: true });
    const parent = panel.current?.parentElement;
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width));
    if (parent) observer.observe(parent);
    function key(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      close.current();
    }
    document.addEventListener("keydown", key);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", key);
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(width));
    } catch {}
  }, [width]);

  function start(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, width: shownWidth };
  }

  function resize(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setWidth(clamp(drag.current.width + drag.current.x - event.clientX));
  }

  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 40 : 16;
    if (event.key === "ArrowLeft") setWidth(clamp(shownWidth + step));
    else if (event.key === "ArrowRight") setWidth(clamp(shownWidth - step));
    else if (event.key === "Home") setWidth(360);
    else if (event.key === "End") setWidth(720);
    else return;
    event.preventDefault();
  }

  return (
    <aside
      ref={panel}
      className="cm-side-panel"
      aria-labelledby={heading}
      data-stacked={stacked}
      style={{ width: stacked ? "100%" : shownWidth }}
    >
      {!stacked && <div
        className="cm-side-panel-resize"
        role="separator"
        tabIndex={0}
        aria-label={`Resize ${title}`}
        aria-orientation="vertical"
        aria-controls={body}
        aria-valuemin={360}
        aria-valuemax={Math.min(720, Math.max(360, available - 400))}
        aria-valuenow={shownWidth}
        onPointerDown={start}
        onPointerMove={resize}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        onLostPointerCapture={() => { drag.current = null; }}
        onKeyDown={keyboard}
      />}
      <header className="cm-side-panel-header">
        <h2 id={heading}>{title}</h2>
        <button ref={closeButton} type="button" aria-label={`Close ${title}`} onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div id={body} className="cm-side-panel-body">{children}</div>
    </aside>
  );
}
