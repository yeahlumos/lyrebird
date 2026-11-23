"use client";

import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";
import starlit from "../../flowball/Starlit Wave and Sparkle.json";

export default function WishAnimation() {
  const container = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let disposed = false;
    let animation: AnimationItem | undefined;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => {
      if (motion.matches) animation?.goToAndStop(29, true);
      else animation?.play();
    };
    import("lottie-web").then(({ default: lottie }) => {
      if (disposed || !container.current) return;
      animation = lottie.loadAnimation({ container: container.current, renderer: "svg", loop: true, autoplay: !motion.matches, animationData: structuredClone(starlit) });
      updateMotion();
    }).catch(() => { /* Keep the labeled link usable if the animation cannot load. */ });
    motion.addEventListener("change", updateMotion);
    return () => { disposed = true; motion.removeEventListener("change", updateMotion); animation?.destroy(); };
  }, []);
  return <span ref={container} className="res-wish-animation" aria-hidden="true" />;
}
