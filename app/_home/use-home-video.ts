import { useEffect, useRef, useState } from "react";

const muteKey = "lyrebird-home-video-muted";

export function useHomeVideo(source?: string) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef(0);
  const [muted, setMuted] = useState<boolean>();
  const [blockedSource, setBlockedSource] = useState<string>();

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setMuted(localStorage.getItem(muteKey) === "true");
    });
    return () => { active = false; };
  }, []);

  const wantsMute = muted ?? false;
  const soundOff = wantsMute || Boolean(source && blockedSource === source);

  useEffect(() => {
    const video = videoRef.current;
    if (!source || !video || muted === undefined) return;

    let active = true;
    const request = ++requestRef.current;
    video.muted = muted;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      void video.play().catch((error: unknown) => {
        if (!active || request !== requestRef.current || muted || !(error instanceof DOMException) || error.name !== "NotAllowedError") return;
        setBlockedSource(source);
        video.muted = true;
        void video.play().catch(() => {});
      });
    }
    return () => { active = false; };
  }, [muted, source]);

  function toggleSound() {
    const nextMute = !soundOff;
    setMuted(nextMute);
    setBlockedSource(undefined);
    localStorage.setItem(muteKey, String(nextMute));
    const video = videoRef.current;
    if (!video) return;

    const request = ++requestRef.current;
    video.muted = nextMute;
    if (!nextMute) {
      void video.play().catch((error: unknown) => {
        if (request !== requestRef.current || !(error instanceof DOMException) || error.name !== "NotAllowedError") return;
        setBlockedSource(source);
        video.muted = true;
        void video.play().catch(() => {});
      });
    }
  }

  return { videoRef, soundOff, toggleSound };
}
