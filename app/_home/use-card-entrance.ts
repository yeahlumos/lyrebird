import { useEffect, type RefObject } from "react";

export function useCardEntrance(grid: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!grid.current || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        target.setAttribute("data-entered", "");
        observer.unobserve(target);
      }
    }, { threshold: 0.15, rootMargin: "0px 0px -24px" });
    for (const card of grid.current.children) observer.observe(card);
    return () => observer.disconnect();
  }, [grid]);
}
