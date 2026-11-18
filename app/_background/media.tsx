"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export const homeBackgroundKey = "lyrebird-background";
export const homeUploadRevisionKey = "lyrebird-background-upload-revision";
export const homeUploadId = "custom";
export const followHome = "follow-home";

const formats = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"];
export const backgroundAccept = formats.join(",");
export const backgroundFormatHint = "JPG、PNG、WebP、GIF、MP4、WebM";

export function isBackgroundFile(file: File) {
  return formats.includes(file.type);
}

export type BackgroundMedia = { url: string; video?: boolean; gradient?: boolean };

const homePresets: Record<string, BackgroundMedia> = {
  bird3: { url: "/bird3.jpg" },
  bird1: { url: "/Bird1.jpg" },
  bird2: { url: "/bird2.jpg" },
  miku: { url: "/初音未来.jpg" },
  frieren: { url: "/芙莉莲.jpg" },
  mist: { url: "linear-gradient(135deg, #658c86 0%, #a9c7bd 46%, #d3dbca 100%)", gradient: true },
  dusk: { url: "linear-gradient(135deg, #24404b 0%, #747b85 52%, #ba9b97 100%)", gradient: true },
  "shoujo-ed": { url: "/backgrounds/shoujo-ed.mp4", video: true },
};

export function createBackgroundMedia(blob: Blob): BackgroundMedia {
  return { url: URL.createObjectURL(blob), video: blob.type.startsWith("video/") };
}

export function backgroundImage(media?: BackgroundMedia) {
  return media && !media.video ? media.gradient ? media.url : `url("${media.url}")` : undefined;
}

export function openBackgroundDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("lyrebird");
    request.onupgradeneeded = () => {
      request.result.createObjectStore("backgrounds");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readBackgroundUpload(id: string): Promise<Blob | undefined> {
  const db = await openBackgroundDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("backgrounds").objectStore("backgrounds").get(id);
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : undefined);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function writeBackgroundUpload(id: string, file?: File): Promise<void> {
  const db = await openBackgroundDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("backgrounds", "readwrite");
      const store = transaction.objectStore("backgrounds");
      if (file) store.put(file, id);
      else store.delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export function useHomeBackground() {
  const [media, setMedia] = useState<BackgroundMedia>(homePresets.bird3);

  useEffect(() => {
    let revision = 0;
    let currentUploadUrl: string | undefined;
    const refresh = async () => {
      const request = ++revision;
      let blob: Blob | undefined;
      let selected = "bird3";
      try {
        selected = localStorage.getItem(homeBackgroundKey) ?? "bird3";
        if (selected === homeUploadId) blob = await readBackgroundUpload(homeUploadId);
      } catch {
        selected = "bird3";
      }
      if (request !== revision) return;
      if (currentUploadUrl) URL.revokeObjectURL(currentUploadUrl);
      const next = blob ? createBackgroundMedia(blob) : homePresets[selected] ?? homePresets.bird3;
      currentUploadUrl = blob ? next.url : undefined;
      setMedia(next);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === homeBackgroundKey || event.key === homeUploadRevisionKey) void refresh();
    };
    void refresh();
    window.addEventListener("storage", onStorage);
    return () => {
      revision++;
      window.removeEventListener("storage", onStorage);
      if (currentUploadUrl) URL.revokeObjectURL(currentUploadUrl);
    };
  }, []);

  return media;
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
function subscribeMotion(callback: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

export function BackgroundVideo({ media, preview = false }: { media?: BackgroundMedia; preview?: boolean }) {
  const reducedMotion = useSyncExternalStore(subscribeMotion, () => window.matchMedia(reducedMotionQuery).matches, () => true);
  if (!media?.video) return null;
  const playing = !preview && !reducedMotion;
  return <video key={`${media.url}:${playing}`} className="pointer-events-none absolute inset-0 h-full w-full rounded-[inherit] object-cover" src={media.url} autoPlay={playing} loop={playing} muted playsInline preload={playing ? "auto" : "metadata"} aria-hidden="true" />;
}

export function FollowHomeButton({ active, onSelect }: { active: boolean; onSelect: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onSelect} className="my-2 rounded-md border px-3 py-2 text-xs aria-pressed:border-emerald-700 aria-pressed:bg-emerald-50">
    跟随首页背景
  </button>;
}
