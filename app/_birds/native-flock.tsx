"use client";

import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";
import flock from "../../flowball/Bird Flock (Test).json";

const palette = [[131 / 255, 172 / 255, 218 / 255, 1], [79 / 255, 140 / 255, 201 / 255, 1], [39 / 255, 106 / 255, 184 / 255, 1]];

function recolor(value: unknown, color: number[]) {
  if (!value || typeof value !== "object") return;
  const item = value as Record<string, unknown>;
  if (item.ty === "fl") item.c = { a: 0, k: color };
  Object.values(item).forEach((child) => recolor(child, color));
}

function animationData() {
  const data = structuredClone(flock);
  // Keep parent controllers and the retained birds' original transforms and keyframes.
  data.assets = data.assets.flatMap((asset) => palette.map((color, depth) => {
    const copy = structuredClone(asset);
    copy.id = `${asset.id}-blue-${depth}`;
    recolor(copy, color);
    return copy;
  }));
  data.layers.forEach((layer) => {
    if (!("refId" in layer) || !layer.refId) return;
    const scale = (layer.ks.s.k as number[])[0] / 220;
    const depth = scale < .62 ? 0 : scale < .82 ? 1 : 2;
    layer.refId += `-blue-${depth}`;
    Object.assign(layer, { cl: "native-flock-bird" });
  });
  return data;
}

export default function NativeFlock() {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    let animation: AnimationItem | undefined;
    const birds: { element: SVGGElement; wrapper: SVGGElement; x: number; y: number }[] = [];
    const pointer = { x: -1000, y: -1000 };
    const burst = { x: -1000, y: -1000, until: 0 };
    let previous = 0;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const interact = () => {
      if (motion.matches || document.hidden) return;
      const now = performance.now();
      const amount = 1 - Math.exp(-Math.min(now - (previous || now - 16.67), 50) / 110);
      previous = now;
      const svg = container.current?.querySelector("svg");
      if (!svg) return;
      const bounds = svg.getBoundingClientRect();
      const scale = Math.min(bounds.width / flock.w, bounds.height / flock.h);
      if (!scale) return;
      for (const bird of birds) {
        const rect = bird.element.getBoundingClientRect();
        let targetX = 0;
        let targetY = 0;
        if (rect.width && rect.height) {
          const x = rect.left + rect.width / 2 - bird.x * scale;
          const y = rect.top + rect.height / 2 - bird.y * scale;
          for (const source of [
            { ...pointer, radius: 120, force: 65 },
            { ...burst, radius: 200, force: now < burst.until ? 125 : 0 },
          ]) {
            const dx = x - source.x;
            const dy = y - source.y;
            const distance = Math.hypot(dx, dy);
            if (distance >= source.radius || !source.force) continue;
            const force = (1 - distance / source.radius) * source.force / scale;
            targetX += (distance > .1 ? dx / distance : 0) * force;
            targetY += (distance > .1 ? dy / distance : -1) * force;
          }
        }
        bird.x += (targetX - bird.x) * amount;
        bird.y += (targetY - bird.y) * amount;
        bird.wrapper.setAttribute("transform", `translate(${bird.x} ${bird.y})`);
      }
    };
    const onMove = (event: PointerEvent) => { pointer.x = event.clientX; pointer.y = event.clientY; };
    const onLeave = () => { pointer.x = -1000; pointer.y = -1000; };
    const onPress = (event: PointerEvent) => {
      burst.x = event.clientX; burst.y = event.clientY; burst.until = performance.now() + 600;
    };
    const update = () => {
      if (motion.matches || document.hidden) { animation?.pause(); onLeave(); burst.until = 0; previous = 0; }
      else animation?.play();
    };
    import("lottie-web").then(({ default: lottie }) => {
      if (disposed || !container.current) return;
      animation = lottie.loadAnimation({ container: container.current, renderer: "svg", loop: true, autoplay: false, animationData: animationData(), rendererSettings: { preserveAspectRatio: "xMidYMid meet" } });
      animation.addEventListener("DOMLoaded", () => {
        if (disposed) return;
        container.current?.querySelectorAll<SVGGElement>(".native-flock-bird").forEach((element) => {
          const wrapper = document.createElementNS("http://www.w3.org/2000/svg", "g");
          element.parentNode?.insertBefore(wrapper, element);
          wrapper.appendChild(element);
          birds.push({ element, wrapper, x: 0, y: 0 });
        });
      });
      animation.addEventListener("drawnFrame", interact);
      update();
    });
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onPress, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      disposed = true;
      animation?.destroy();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onPress);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      motion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return <div className="native-flock" ref={container} aria-hidden="true" />;
}
