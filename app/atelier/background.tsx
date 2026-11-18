"use client";

import { useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import {
  BackgroundVideo, FollowHomeButton, backgroundAccept, backgroundFormatHint, backgroundImage,
  createBackgroundMedia, isBackgroundFile, readBackgroundUpload, useHomeBackground,
  writeBackgroundUpload, type BackgroundMedia,
} from "../_background/media";

const uploadId = "lyrebird-atelier:background";

export default function AtelierBackground() {
  const homeBackground = useHomeBackground();
  const [override, setOverride] = useState<BackgroundMedia>();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const urlRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    readBackgroundUpload(uploadId).then((blob) => {
      if (!active || !blob) return;
      const media = createBackgroundMedia(blob);
      urlRef.current = media.url;
      setOverride(media);
    }).catch(() => {
      if (active) setError("背景读取失败，请刷新重试。");
    }).finally(() => {
      if (active) setBusy(false);
    });
    return () => {
      active = false;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  async function select(file?: File) {
    if (file && !isBackgroundFile(file)) {
      setError(`请选择 ${backgroundFormatHint} 文件。`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await writeBackgroundUpload(uploadId, file);
      const media = file ? createBackgroundMedia(file) : undefined;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = media?.url;
      setOverride(media);
    } catch {
      setError("背景保存失败，请检查浏览器存储空间。");
    } finally {
      setBusy(false);
    }
  }

  const media = override ?? homeBackground;
  return <>
    <div className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: backgroundImage(media) }}><BackgroundVideo media={media} /></div>
    <div className="absolute top-6 right-6 z-10">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="造物背景设置" className="ml-auto grid h-10 w-10 place-items-center rounded-full border border-neutral-200 bg-white/90"><Settings size={19} /></button>
      {open && <div className="mt-2 grid gap-2 rounded-md border border-neutral-200 bg-white p-4 shadow-lg">
        <FollowHomeButton active={!override} onSelect={() => { if (!busy && override) void select(); }} />
        <label htmlFor="atelier-background-upload" className="cursor-pointer rounded-md border px-3 py-2 text-xs">上传造物背景</label>
        <input id="atelier-background-upload" className="visually-hidden" type="file" accept={backgroundAccept} disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void select(file); event.target.value = ""; }} />
        <small>{backgroundFormatHint}</small>
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      </div>}
    </div>
  </>;
}
