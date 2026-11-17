import { useEffect, useState, type RefObject } from "react";

export function useHeroEntrance(home: RefObject<HTMLElement | null>) {
  const [entrance, setEntrance] = useState(0);

  useEffect(() => {
    const hero = home.current?.querySelector<HTMLElement>(".hero");
    if (!hero || !("IntersectionObserver" in window)) return;

    let wasVisible = true;
    const observer = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting && entry.intersectionRatio >= 0.6;
      if (visible && !wasVisible) setEntrance((current) => current + 1);
      wasVisible = visible;
    }, { threshold: [0, 0.6] });
    observer.observe(hero);
    return () => observer.disconnect();
  }, [home]);

  return entrance;
}
