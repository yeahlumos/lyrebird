import { useEffect, type RefObject } from "react";

export function useSectionWheel(container: RefObject<HTMLElement | null>, paused: boolean) {
  useEffect(() => {
    if (paused) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lastWheel = -Infinity;
    let lockedUntil = 0;

    function onWheel(event: WheelEvent) {
      if (!event.cancelable || event.ctrlKey || event.metaKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (event.target instanceof Element && event.target.closest("[role='dialog'], [data-native-scroll]")) return;

      const now = performance.now();
      const continuing = now - lastWheel < 180;
      lastWheel = now;
      if (now < lockedUntil || (lockedUntil > 0 && continuing)) {
        event.preventDefault();
        return;
      }
      lockedUntil = 0;

      // Only move between sections at an edge. Taller sections keep native scrolling.
      const sections = [...(container.current?.querySelectorAll<HTMLElement>(":scope > [data-scroll-section]") ?? [])];
      const direction = Math.sign(event.deltaY);
      const current = sections.findLastIndex((section) => section.getBoundingClientRect().top <= 2);
      const section = sections[current];
      const next = sections[current + direction];
      if (!section || !next) return;

      const bounds = section.getBoundingClientRect();
      const atEdge = direction > 0 ? bounds.bottom <= window.innerHeight + 2 : bounds.top >= -2;
      if (!atEdge) return;
      event.preventDefault();
      lockedUntil = now + (motion.matches ? 180 : 650);
      next.scrollIntoView({ behavior: motion.matches ? "instant" : "smooth", block: "start" });
    }

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [container, paused]);
}
