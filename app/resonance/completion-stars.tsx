"use client";

import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";
import stars from "../../flowball/Wish Completion Stars.json";

export default function CompletionStars({ x, y, onEnd }: { x: number; y: number; onEnd: () => void }) {
  const container = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let disposed = false;
    let animation: AnimationItem | undefined;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => { if (!disposed) onEnd(); };
    const timer = window.setTimeout(stop, 2200);
    if (motion.matches) { queueMicrotask(stop); }
    else import("lottie-web").then(({ default: lottie }) => {
      if (disposed || !container.current) return;
      animation = lottie.loadAnimation({ container: container.current, renderer: "svg", loop: false, autoplay: true, animationData: structuredClone(stars) });
      animation.addEventListener("complete", stop);
    }).catch(stop);
    motion.addEventListener("change", stop);
    return () => { disposed = true; window.clearTimeout(timer); motion.removeEventListener("change", stop); animation?.destroy(); };
  }, [onEnd]);
  return <span ref={container} className="res-completion-stars" style={{ left: x, top: y }} aria-hidden="true" />;
}
