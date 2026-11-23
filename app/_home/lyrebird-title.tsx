"use client";

import { useState, type MouseEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";

const letters = [..."Lyrebird"];
const resting = letters.map(() => 0);
const spring = { type: "spring" as const, stiffness: 260, damping: 22 };
const tint = (strength: number, red: number, green: number, blue: number) =>
  `rgb(${255 - (255 - red) * strength}, ${255 - (255 - green) * strength}, ${255 - (255 - blue) * strength})`;

export default function LyrebirdTitle() {
  const [resonance, setResonance] = useState(resting);
  const reducedMotion = useReducedMotion();

  const handleMouseMove = (event: MouseEvent<HTMLHeadingElement>) => {
    if (reducedMotion) return;
    const spans = event.currentTarget.querySelectorAll("span");
    setResonance(Array.from(spans, (span) => {
      const rect = span.getBoundingClientRect();
      const distance = event.clientX - (rect.left + rect.width / 2);
      return Math.exp(-(distance * distance) / (2 * 75 * 75));
    }));
  };

  return (
    <h1 id="site-title" aria-label="Lyrebird" onMouseMove={handleMouseMove} onMouseLeave={() => setResonance(resting)}>
      {letters.map((letter, index) => {
        const strength = resonance[index];
        return (
          <motion.span
            key={index}
            aria-hidden="true"
            style={{
              backgroundImage: `linear-gradient(115deg, ${tint(strength, 205, 250, 255)} 5%, ${tint(strength, 103, 194, 255)} 48%, ${tint(strength, 141, 157, 246)} 85%)`,
            }}
            animate={{
              fontWeight: 350 + 350 * strength,
              y: -5 * strength,
              scale: 1 + 0.04 * strength,
            }}
            transition={reducedMotion ? { duration: 0 } : spring}
          >
            {letter}
          </motion.span>
        );
      })}
    </h1>
  );
}
