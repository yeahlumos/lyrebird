"use client";

import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";
import stars from "../../flowball/Wish Completion Stars.json";

export default function AnniversaryStars() {
  const container = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let disposed = false;
    let animation: AnimationItem | undefined;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => {
      if (motion.matches) animation?.goToAndStop(16, true);
      else animation?.play();
    };
    import("lottie-web").then(({ default: lottie }) => {
      if (disposed || !container.current) return;
      animation = lottie.loadAnimation({ container: container.current, renderer: "svg", loop: true, autoplay: !motion.matches, animationData: structuredClone(stars) });
      updateMotion();
    }).catch(() => { /* The dated reminder remains available if playback fails. */ });
    motion.addEventListener("change", updateMotion);
    return () => { disposed = true; motion.removeEventListener("change", updateMotion); animation?.destroy(); };
  }, []);
  return <span ref={container} className="res-anniversary-stars" aria-hidden="true" />;
}
