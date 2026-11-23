"use client";

import { useEffect, useRef, useState } from "react";
import type { AnimationItem } from "lottie-web";
import airBird from "../../flowball/air bird.json";
import { birdStyleChangeEvent, birdStyleKey, parseBirdStyle } from "./flight";
import { cursorBirdKey, cursorBirdChangeEvent } from "./cursor-preference";
import "./cursor-bird.css";

export default function CursorBird() {
  const [disabled, setDisabled] = useState(false);
  const follower = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const trail = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const syncStyle = () => setDisabled(parseBirdStyle(localStorage.getItem(birdStyleKey)) === "none" || localStorage.getItem(cursorBirdKey) === "off");
    syncStyle();
    window.addEventListener("storage", syncStyle);
    window.addEventListener(birdStyleChangeEvent, syncStyle);
    window.addEventListener(cursorBirdChangeEvent, syncStyle);
    return () => {
      window.removeEventListener("storage", syncStyle);
      window.removeEventListener(birdStyleChangeEvent, syncStyle);
      window.removeEventListener(cursorBirdChangeEvent, syncStyle);
    };
  }, []);

  useEffect(() => {
    if (disabled) return;
    const actor = follower.current;
    const host = container.current;
    const canvas = trail.current;
    const context = canvas?.getContext("2d");
    if (!actor || !host || !canvas || !context) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let animation: AnimationItem | undefined;
    let disposed = false;
    let frame = 0;
    let previous = 0;
    let visible = false;
    let x = 0;
    let y = 0;
    let targetX = 0;
    let targetY = 0;
    const points: { x: number; y: number; time: number }[] = [];
    const particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number; life: number; star: boolean; phase: number }[] = [];
    const colors = ["#ffe9ff", "#a884ff", "#f5a6ff", "#ddd0ff", "#c785ff", "#ffffff"];

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = window.innerWidth * ratio;
      canvas!.height = window.innerHeight * ratio;
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function drawTrail(now: number) {
      context!.clearRect(0, 0, window.innerWidth, window.innerHeight);
      while (points.length && now - points[0].time > 600) points.shift();
      if (points.length > 1) {
        const first = points[0];
        const last = points[points.length - 1];
        const fade = Math.min(1, (600 - now + last.time) / 250);
        const gradient = context!.createLinearGradient(first.x, first.y, last.x + .1, last.y + .1);
        gradient.addColorStop(0, "rgba(167, 110, 255, 0)");
        gradient.addColorStop(.5, "rgba(167, 110, 255, .5)");
        gradient.addColorStop(1, "rgba(245, 203, 255, .85)");
        context!.save();
        context!.globalAlpha = fade;
        context!.beginPath();
        context!.moveTo(first.x, first.y);
        for (let index = 1; index < points.length - 1; index++) {
          const point = points[index];
          const next = points[index + 1];
          context!.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
        }
        context!.lineTo(last.x, last.y);
        context!.lineCap = "round";
        context!.strokeStyle = gradient;
        context!.lineWidth = 6;
        context!.shadowColor = "#bd80ff";
        context!.shadowBlur = 12;
        context!.stroke();
        const core = context!.createLinearGradient(first.x, first.y, last.x + .1, last.y + .1);
        core.addColorStop(0, "rgba(255, 242, 255, 0)");
        core.addColorStop(.5, "rgba(255, 242, 255, .35)");
        core.addColorStop(1, "rgba(255, 242, 255, .75)");
        context!.lineWidth = 1.25;
        context!.strokeStyle = core;
        context!.shadowBlur = 0;
        context!.stroke();
        context!.restore();
      }
      for (let index = particles.length - 1; index >= 0; index--) {
        const particle = particles[index];
        const age = Math.max(0, now - particle.life);
        particle.vy += .2;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.opacity *= .955;
        if (age > 750 || particle.opacity < .02) { particles.splice(index, 1); continue; }
        const twinkle = .65 + .35 * Math.sin(now / 70 + particle.phase);
        context!.save();
        context!.translate(particle.x, particle.y);
        context!.rotate(particle.phase + now / 900);
        context!.globalAlpha = particle.opacity * twinkle;
        context!.fillStyle = colors[Math.floor(particle.phase * 10) % colors.length];
        context!.shadowColor = "#c084fc";
        context!.shadowBlur = 13;
        if (particle.star) {
          context!.beginPath();
          context!.moveTo(0, -particle.size);
          context!.lineTo(particle.size * .36, -particle.size * .36);
          context!.lineTo(particle.size, 0);
          context!.lineTo(particle.size * .36, particle.size * .36);
          context!.lineTo(0, particle.size);
          context!.lineTo(-particle.size * .36, particle.size * .36);
          context!.lineTo(-particle.size, 0);
          context!.lineTo(-particle.size * .36, -particle.size * .36);
          context!.closePath();
          context!.fill();
        } else {
          context!.beginPath();
          context!.arc(0, 0, particle.size * .55, 0, Math.PI * 2);
          context!.fill();
        }
        context!.restore();
      }
    }

    // Keep the supplied bird silhouette; the pointer replaces its baked-in route.
    const bird = structuredClone(airBird.assets[0].layers[0]);
    const animationData = {
      ...airBird, ddd: 0, w: 200, h: 180, ip: 0, op: 48, assets: [],
      layers: [{
        ...bird, ddd: 0, ao: 0, ip: 0, op: 48,
        ks: {
          o: { a: 0, k: 100 }, r: { a: 0, k: 0 },
          p: { a: 0, k: [100, 90, 0] }, a: { a: 0, k: [990.367, 340.186, 0] },
          s: { a: 1, k: [0, 24, 48].map((t, index) => ({
            t, s: [100, index === 1 ? 100 : 76, 100],
            i: { x: [0.667, 0.667, 0.667], y: [1, 1, 1] },
            o: { x: [0.333, 0.333, 0.333], y: [0, 0, 0] },
          })) },
        },
        shapes: bird.shapes.map((group) => ({ ...group, it: group.it.map((shape) => shape.ty === "fl" ? {
          ty: "gf", nm: "Lavender gradient", t: 1, r: 1,
          o: { a: 0, k: 100 }, s: { a: 0, k: [-73, -52] }, e: { a: 0, k: [73, 52] },
          g: { p: 3, k: { a: 0, k: [0, 0.88, 0.78, 1, 0.5, 0.65, 0.46, 0.88, 1, 0.43, 0.42, 0.81] } },
        } : shape) })),
      }],
    };

    function hide() {
      visible = false;
      actor!.style.opacity = "0";
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      points.length = 0;
      particles.length = 0;
      context!.clearRect(0, 0, window.innerWidth, window.innerHeight);
      animation?.pause();
    }

    function tick(now: number) {
      const amount = 1 - Math.exp(-Math.min(now - (previous || now - 16.67), 50) / 85);
      previous = now;
      x += (targetX - x) * amount;
      y += (targetY - y) * amount;
      actor!.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      const moving = Math.hypot(targetX - x, targetY - y) > 0.2;
      const trailX = x + 28;
      const trailY = y + 28;
      const last = points[points.length - 1];
      if (moving && (!last || Math.hypot(trailX - last.x, trailY - last.y) > 5)) {
        points.push({ x: trailX, y: trailY, time: now });
        for (let index = 0; index < 2; index++) particles.push({
          x: trailX + (Math.random() - .5) * 12,
          y: trailY + (Math.random() - .5) * 12,
          vx: (Math.random() - .5) * 2.5,
          vy: -Math.random() * 2.4 - .4,
          size: 1.5 + Math.random() * 2.85,
          opacity: .6 + Math.random() * .4,
          life: now,
          star: Math.random() > .42,
          phase: Math.random() * Math.PI * 2,
        });
        if (particles.length > 160) particles.splice(0, particles.length - 160);
      }
      drawTrail(now);
      if (moving || points.length || particles.length) frame = requestAnimationFrame(tick);
      else { frame = 0; previous = 0; }
    }

    function follow(event: PointerEvent) {
      if (event.pointerType !== "mouse" || motion.matches || !finePointer.matches) return;
      targetX = Math.max(0, Math.min(window.innerWidth - 58, event.clientX - 19));
      targetY = Math.max(0, Math.min(window.innerHeight - 52, event.clientY - 28));
      if (!visible) {
        x = targetX; y = targetY; visible = true;
        actor!.style.opacity = "0.9";
        animation?.play();
      }
      if (!frame) frame = requestAnimationFrame(tick);
    }

    function onVisibility() { if (document.hidden) hide(); }
    function onPress(event: PointerEvent) {
      for (let index = 0; index < 21; index++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 4;
        particles.push({ x: event.clientX, y: event.clientY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1, size: 1.5 + Math.random() * 2.85, opacity: .7 + Math.random() * .3, life: performance.now(), star: Math.random() > .32, phase: Math.random() * Math.PI * 2 });
      }
      if (!frame) frame = requestAnimationFrame(tick);
    }
    import("lottie-web").then(({ default: lottie }) => {
      if (disposed) return;
      animation = lottie.loadAnimation({ container: host, renderer: "svg", loop: true, autoplay: false, animationData });
      if (visible) animation.play();
    });
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", follow, { passive: true });
    window.addEventListener("pointerdown", onPress, { passive: true });
    document.documentElement.addEventListener("pointerleave", hide);
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", onVisibility);
    motion.addEventListener("change", hide);
    finePointer.addEventListener("change", hide);
    return () => {
      disposed = true;
      hide(); animation?.destroy();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", follow);
      window.removeEventListener("pointerdown", onPress);
      document.documentElement.removeEventListener("pointerleave", hide);
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", onVisibility);
      motion.removeEventListener("change", hide);
      finePointer.removeEventListener("change", hide);
    };
  }, [disabled]);

  if (disabled) return null;
  return <><canvas ref={trail} className="cursor-air-trail" aria-hidden="true" /><div ref={follower} className="cursor-air-bird" aria-hidden="true"><div ref={container} /></div></>;
}
