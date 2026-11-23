"use client";

import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";
import cat from "../../flowball/Bouncing Black Cat.json";
import AnniversaryStars from "./anniversary-stars";

export default function PetAnimation({ celebrating = false }: { celebrating?: boolean }) {
  const container = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let disposed = false;
    let animation: AnimationItem | undefined;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => {
      if (motion.matches) animation?.goToAndStop(0, true);
      else animation?.play();
    };
    import("lottie-web").then(({ default: lottie }) => {
      if (disposed || !container.current) return;
      animation = lottie.loadAnimation({ container: container.current, renderer: "svg", loop: true, autoplay: !motion.matches, animationData: structuredClone(cat) });
      animation.setSubframe(false);
      updateMotion();
    }).catch(() => { /* Keep the named pet controls available if playback fails. */ });
    motion.addEventListener("change", updateMotion);
    return () => { disposed = true; motion.removeEventListener("change", updateMotion); animation?.destroy(); };
  }, []);
  return <span className="res-pet-animation" aria-hidden="true"><span ref={container} className="res-pet-drawing" />{celebrating && <AnniversaryStars />}</span>;
}
