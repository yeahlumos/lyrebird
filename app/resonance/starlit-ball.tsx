"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import Link from "next/link";
import WishAnimation from "./wish-animation";

const positionKey = "lyrebird-starlit-position";

export default function StarlitBall({ relationshipId }: { relationshipId: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const drag = useRef<{ pointer: number; x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => {
    const restore = () => {
      const element = ref.current;
      if (!element) return;
      try {
        const saved = JSON.parse(localStorage.getItem(positionKey) ?? "null");
        if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return;
        element.style.left = `${Math.max(0, Math.min(1, saved.x)) * Math.max(0, window.innerWidth - element.offsetWidth)}px`;
        element.style.top = `${Math.max(0, Math.min(1, saved.y)) * Math.max(0, window.innerHeight - element.offsetHeight)}px`;
        element.style.right = "auto";
        element.style.bottom = "auto";
      } catch { /* Use the corner position if a preference cannot be restored. */ }
    };
    restore();
    window.addEventListener("resize", restore);
    return () => window.removeEventListener("resize", restore);
  }, []);
  const finish = (event: PointerEvent<HTMLAnchorElement>, cancelled = false) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    if (current.moved) {
      suppressClick.current = true;
      const element = event.currentTarget;
      const bounds = element.getBoundingClientRect();
      try {
        localStorage.setItem(positionKey, JSON.stringify({
          x: bounds.left / Math.max(1, window.innerWidth - bounds.width),
          y: bounds.top / Math.max(1, window.innerHeight - bounds.height),
        }));
      } catch { /* Dragging remains available without persistent storage. */ }
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    event.currentTarget.classList.remove("dragging");
    drag.current = null;
    if (cancelled) suppressClick.current = false;
  };
  return <Link ref={ref} className="res-starlit-ball" href={`/resonance/${relationshipId}/bucket-list`} title="Starlit · 点击打开心愿清单，拖动调整位置" aria-label="Starlit 心愿清单，可拖动" draggable={false}
    onPointerDown={(event) => {
      if (event.button !== 0) return;
      suppressClick.current = false;
      const bounds = event.currentTarget.getBoundingClientRect();
      drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, left: bounds.left, top: bounds.top, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={(event) => {
      const current = drag.current;
      if (!current || current.pointer !== event.pointerId) return;
      const dx = event.clientX - current.x, dy = event.clientY - current.y;
      if (!current.moved && Math.hypot(dx, dy) < 5) return;
      current.moved = true;
      const element = event.currentTarget;
      element.classList.add("dragging");
      element.style.left = `${Math.max(0, Math.min(window.innerWidth - element.offsetWidth, current.left + dx))}px`;
      element.style.top = `${Math.max(0, Math.min(window.innerHeight - element.offsetHeight, current.top + dy))}px`;
      element.style.right = "auto"; element.style.bottom = "auto";
    }}
    onPointerUp={(event) => finish(event)} onPointerCancel={(event) => finish(event, true)}
    onClick={(event) => { if (suppressClick.current) { event.preventDefault(); suppressClick.current = false; } }}>
    <WishAnimation /><small>Starlit</small>
  </Link>;
}
