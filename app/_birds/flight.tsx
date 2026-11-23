"use client";

import { useEffect, useRef, useState } from "react";
import flyingBird from "../../flowball/flying bird.json";
import FlockShape from "./flock-shape";
import NativeFlock from "./native-flock";
import "./flight.css";

export type BirdStyle = "outline" | "lottie" | "flock" | "none";
export const parseBirdStyle = (value: string | null): BirdStyle => value === "lottie" || value === "flock" || value === "none" ? value : "outline";
export const birdStyleKey = "lyrebird-bird-style";
export const birdStyleChangeEvent = "lyrebird-bird-style-change";
const lottieFrames = flyingBird.assets.flatMap((asset) => "p" in asset && asset.p?.startsWith("data:image/") ? [asset.p] : []);

type Point = { x: number; y: number };
type Flight = {
  start: Point;
  control1: Point;
  control2: Point;
  end: Point;
  started: number;
  duration: number;
  direction: number;
  scale: number;
  opacity: number;
  flapSpeed: number;
  phase: number;
  offset: Point;
  velocity: Point;
  startled: boolean;
  lastEscape: number;
};

const random = (min: number, max: number) => min + Math.random() * (max - min);
const curve = (a: number, b: number, c: number, d: number, t: number) =>
  (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;
const birdCount = 18;
const flockSlots = 12;

const birdPoses = [
  {
    viewBox: "0 0 210 150",
    facesRight: false,
    outline: (flap: number) => `M3 96 C8 99 11 104 12 108 C7 109 3 109 1 111 C8 128 26 139 52 145 C87 153 132 138 153 105 C170 117 185 134 194 140 C200 143 206 136 208 131 C199 124 186 115 178 105 C175 98 183 87 185 75 C190 49 160 19 119 ${1 + flap * 9} C109 ${-2 + flap * 9} 103 ${3 + flap * 9} 104 ${7 + flap * 9} C105 15 110 22 115 28 C107 30 102 31 98 34 C102 43 108 51 108 58 C109 70 99 76 84 83 C57 97 28 105 3 96 Z`,
  },
  {
    viewBox: "0 0 215 210",
    facesRight: false,
    outline: (flap: number) => `M0 173 C27 164 51 153 77 137 C93 126 106 115 121 109 C117 94 111 81 105 71 C110 68 116 68 122 70 C112 58 104 46 101 29 C99 14 99 4 102 ${0 + flap * 11} C112 ${8 + flap * 8} 118 30 129 48 C141 68 149 91 155 113 C163 140 174 157 185 170 C196 181 205 188 212 196 C212 200 209 204 206 204 C195 192 184 178 174 167 C164 155 155 155 145 160 C128 168 119 179 105 189 C85 206 60 211 38 203 C20 197 7 185 0 173 Z`,
  },
  {
    viewBox: "0 0 100 215",
    facesRight: false,
    outline: (flap: number) => `M7 91 C15 88 24 88 31 90 C30 77 37 66 44 54 C53 36 61 17 63 ${0 + flap * 10} C72 ${0 + flap * 10} 78 5 82 12 C93 34 89 67 79 91 C75 104 69 113 65 118 C72 130 83 139 94 149 C96 154 95 160 91 160 C83 153 75 145 67 143 C60 162 54 179 43 192 C31 206 14 214 0 ${210 - flap * 7} C15 190 17 159 15 138 C14 124 18 113 22 107 C14 104 10 98 7 91 Z`,
  },
  {
    viewBox: "0 0 190 175",
    facesRight: false,
    outline: (flap: number) => `M0 47 C13 48 21 50 31 56 C40 49 43 44 46 39 C56 22 65 10 76 ${0 + flap * 9} C83 ${0 + flap * 9} 87 9 87 20 C86 31 83 41 83 51 C114 47 151 33 180 19 C185 17 188 17 187 ${23 + flap * 8} C184 52 166 80 143 99 C120 116 94 122 70 121 C75 143 88 158 107 173 C84 164 62 143 45 125 C35 113 27 104 25 90 C22 73 10 57 0 47 Z`,
  },
];

export function BirdShape({ variant = 0 }: { variant?: number }) {
  const pose = birdPoses[variant % birdPoses.length];
  const resting = pose.outline(0);
  const flapping = pose.outline(1);
  return (
    <svg viewBox={pose.viewBox} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={resting}>
        <animate attributeName="d" values={`${resting};${flapping};${resting}`} dur="2.4s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

export default function FlightSky() {
  const actors = useRef<(HTMLDivElement | null)[]>([]);
  const [birdStyle, setBirdStyle] = useState<BirdStyle>("outline");

  useEffect(() => {
    const syncStyle = () => setBirdStyle(parseBirdStyle(localStorage.getItem(birdStyleKey)));
    syncStyle();
    window.addEventListener("storage", syncStyle);
    window.addEventListener(birdStyleChangeEvent, syncStyle);
    return () => {
      window.removeEventListener("storage", syncStyle);
      window.removeEventListener(birdStyleChangeEvent, syncStyle);
    };
  }, []);

  useEffect(() => {
    if (birdStyle === "none") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    actors.current.forEach((actor) => { if (actor) actor.style.opacity = "0"; });
    const flights: (Flight | null)[] = Array(birdCount).fill(null);
    const mouse = { x: -1000, y: -1000 };
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let frame = 0;
    let lastFrame = 0;
    let lastTrigger = -Infinity;
    let lastScroll = window.scrollY;
    let scrollDistance = 0;

    function after(callback: () => void, delay: number) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        callback();
      }, delay);
      timers.add(timer);
    }

    function tick(now: number) {
      frame = 0;
      if (media.matches || document.hidden) return;
      const dt = Math.min((now - (lastFrame || now)) / 16.67, 2);
      lastFrame = now;
      flights.forEach((flight, index) => {
        if (!flight) return;
        const actor = actors.current[index];
        if (!actor) return;
        const t = Math.min((now - flight.started) / flight.duration, 1);
        if (t >= 1) {
          flights[index] = null;
          actor.style.opacity = "0";
          return;
        }
        const x = curve(flight.start.x, flight.control1.x, flight.control2.x, flight.end.x, t);
        const y = curve(flight.start.y, flight.control1.y, flight.control2.y, flight.end.y, t) + Math.sin(t * 18 + flight.phase) * 7;
        const dx = x + flight.offset.x - 50 * flight.scale - mouse.x;
        const dy = y + flight.offset.y - 34 * flight.scale - mouse.y;
        const distance = Math.hypot(dx, dy);
        const startled = distance < 110 && distance > 1;
        if (startled) {
          const force = (110 - distance) / 110;
          if (!flight.startled && now - flight.lastEscape > 900) {
            flight.velocity.x += (dx / distance) * 13;
            flight.velocity.y += (dy / distance) * 13 - 5;
            flight.started -= 350;
            flight.lastEscape = now;
          }
          flight.velocity.x += (dx / distance) * force * 1.3 * dt;
          flight.velocity.y += (dy / distance) * force * 1.3 * dt;
          flight.started -= force * 5 * dt;
        }
        flight.startled = startled;
        flight.velocity.x *= Math.pow(.9, dt);
        flight.velocity.y *= Math.pow(.9, dt);
        flight.offset.x = Math.max(-140, Math.min(140, (flight.offset.x + flight.velocity.x * dt) * Math.pow(.985, dt)));
        flight.offset.y = Math.max(-140, Math.min(140, (flight.offset.y + flight.velocity.y * dt) * Math.pow(.985, dt)));
        const next = Math.min(t + .005, 1);
        const nextX = curve(flight.start.x, flight.control1.x, flight.control2.x, flight.end.x, next);
        const nextY = curve(flight.start.y, flight.control1.y, flight.control2.y, flight.end.y, next) + Math.sin(next * 18 + flight.phase) * 7;
        const angle = Math.atan2(nextY - y, nextX - x) * 180 / Math.PI;
        const pitch = Math.max(-14, Math.min(14, birdStyle === "flock" ? angle + 180 : angle - 20));
        actor.style.transform = `translate3d(${x + flight.offset.x}px, ${y + flight.offset.y}px, 0) scale(${flight.scale}) rotate(${(birdStyle === "outline" ? 180 : 0) + pitch}deg)`;
        actor.style.opacity = String(flight.opacity * Math.min(1, t * 8, (1 - t) * 8));
        const fastFlap = startled || now - flight.lastEscape < 1100;
        if ((actor.dataset.fastFlap === "true") !== fastFlap) {
          actor.dataset.fastFlap = String(fastFlap);
          actor.querySelectorAll("animate").forEach((animation) => animation.setAttribute("dur", fastFlap ? ".76s" : `${flight.flapSpeed * 2}s`));
        }
        if (birdStyle === "lottie") {
          const image = actor.querySelector<HTMLElement>(".flight-frame");
          const frameIndex = Math.floor((now + flight.phase * 100) / (fastFlap ? 24 : flight.flapSpeed * 40)) % lottieFrames.length;
          const frameSource = lottieFrames[frameIndex];
          if (image && frameSource && image.dataset.frame !== String(frameIndex)) {
            image.style.maskImage = `url("${frameSource}")`;
            image.dataset.frame = String(frameIndex);
          }
        }
      });
      if (flights.some(Boolean)) frame = requestAnimationFrame(tick);
    }

    function spawn(index: number, fromTop = false, formation?: { startY: number; endY: number; duration: number }) {
      if (media.matches || document.hidden || flights[index]) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const direction = birdStyle === "flock" ? -1 : 1;
      const spreadX = formation ? random(-45, 45) : 0;
      const spreadY = formation ? random(-Math.min(h * .07, 65), Math.min(h * .07, 65)) : 0;
      const start = birdStyle === "flock"
        ? { x: fromTop ? random(w * .45, w * .9) : w + 120, y: fromTop ? h + 90 : random(h * .6, h * .96) }
        : fromTop
        ? { x: random(w * .1, w * .55), y: -90 }
        : { x: formation ? -40 + spreadX : -120, y: formation ? formation.startY + spreadY : random(h * .04, h * .4) };
      const end = birdStyle === "flock"
        ? { x: -155, y: random(h * .05, h * .35) }
        : { x: w + 155 + spreadX, y: formation ? formation.endY + spreadY * .4 : random(h * .62, h * .95) };
      const descent = end.y - start.y;
      const scale = formation ? random(.46, .98) : random(.62, 1.05);
      const flight: Flight = {
        start,
        control1: { x: start.x + direction * w * .28, y: start.y + descent * random(.15, .35) },
        control2: { x: end.x - direction * w * .28, y: end.y - descent * random(.15, .35) },
        end,
        started: performance.now(),
        duration: formation ? formation.duration * random(.94, 1.06) : random(9500, 13500),
        direction,
        scale,
        opacity: scale < .62 ? .56 : scale < .82 ? .68 : .78,
        flapSpeed: random(1.05, 1.45),
        phase: random(0, Math.PI * 2),
        offset: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        startled: false,
        lastEscape: -Infinity,
      };
      flights[index] = flight;
      const actor = actors.current[index];
      if (actor) {
        actor.style.color = scale < .62 ? "#83acda" : scale < .82 ? "#4f8cc9" : "#276ab8";
        actor.dataset.fastFlap = "false";
        actor.querySelectorAll("animate").forEach((animation) => animation.setAttribute("dur", `${flight.flapSpeed * 2}s`));
      }
      if (!frame) {
        lastFrame = 0;
        frame = requestAnimationFrame(tick);
      }
    }

    function flock() {
      const h = window.innerHeight;
      const startY = random(-h * .05, h * .1);
      const formation = { startY, endY: random(h * .67, h * .86), duration: random(8500, 10500) };
      const count = window.innerWidth < 600 ? 9 : flockSlots;
      for (let index = 0; birdStyle !== "flock" && index < count; index++) {
        after(() => spawn(index, false, formation), index * 105 + random(0, 80));
      }
      const groups = Math.random() < .5 ? [2, 1, 1] : [2, 1, 2];
      let delay = 6800;
      for (const groupSize of groups) {
        for (let index = 0; index < groupSize; index++) {
          after(() => {
            const slot = flights.findIndex((flight, slotIndex) => slotIndex >= flockSlots && !flight);
            if (slot !== -1) spawn(slot, Math.random() < .5);
          }, delay + index * 280);
        }
        delay += random(2300, 2800);
      }
      after(flock, 19500);
    }

    function trigger(fromTop = false) {
      const now = performance.now();
      if (now - lastTrigger < 8000) return;
      const index = flights.findIndex((flight, slotIndex) => slotIndex >= flockSlots && !flight);
      if (index === -1) return;
      lastTrigger = now;
      spawn(index, fromTop);
    }

    function onScroll() {
      const current = window.scrollY;
      const delta = current - lastScroll;
      scrollDistance = delta > 0 ? scrollDistance + delta : 0;
      if (scrollDistance > 80) {
        trigger(true);
        scrollDistance = 0;
      }
      lastScroll = current;
    }
    function onPointerMove(event: PointerEvent) {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    }
    function onTouchMove(event: TouchEvent) {
      const touch = event.touches[0];
      if (!touch) return;
      mouse.x = touch.clientX;
      mouse.y = touch.clientY;
    }
    function onPointerLeave() { mouse.x = -1000; mouse.y = -1000; }
    function onMotionChange() {
      if (!media.matches && !document.hidden) return;
      cancelAnimationFrame(frame);
      frame = 0;
      flights.fill(null);
      actors.current.forEach((actor) => { if (actor) actor.style.opacity = "0"; });
    }
    function onLogoEnter(event: PointerEvent) {
      const mark = event.target instanceof Element ? event.target.closest(".topline-mark") : null;
      if (mark && !(event.relatedTarget instanceof Node && mark.contains(event.relatedTarget))) trigger(true);
    }
    document.addEventListener("pointerover", onLogoEnter);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onPointerLeave);
    window.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onMotionChange);
    media.addEventListener("change", onMotionChange);
    after(flock, 0);
    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerover", onLogoEnter);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onPointerLeave);
      window.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onMotionChange);
      media.removeEventListener("change", onMotionChange);
    };
  }, [birdStyle]);

  if (birdStyle === "none") return null;

  return <div className="flight-sky" aria-hidden="true">
    {birdStyle === "flock" && <NativeFlock />}
    {Array.from({ length: birdCount }, (_, index) => <div className="flight-actor" key={index} ref={(node) => { actors.current[index] = node; }}>{birdStyle === "outline" ? <BirdShape variant={index} /> : birdStyle === "flock" ? (index >= flockSlots ? <FlockShape variant={index} /> : null) : <span className="flight-frame" style={{ maskImage: `url("${lottieFrames[0]}")` }} />}</div>)}
  </div>;
}
