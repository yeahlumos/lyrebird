"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { BackgroundVideo, FollowHomeButton, backgroundAccept, backgroundFormatHint, backgroundImage, createBackgroundMedia, isBackgroundFile, readBackgroundUpload, useHomeBackground, writeBackgroundUpload, type BackgroundMedia } from "../_background/media";

const presets = [
  { id: "bird3", name: "飞鸟 3", url: "/bird3.jpg" },
  { id: "bird1", name: "飞鸟 1", url: "/Bird1.jpg" },
  { id: "bird2", name: "飞鸟 2", url: "/bird2.jpg" },
  { id: "miku", name: "初音未来", url: "/初音未来.jpg" },
  { id: "frieren", name: "芙莉莲", url: "/芙莉莲.jpg" },
  { id: "shoujo-ed", name: "少终 ED", url: "/backgrounds/shoujo-ed.mp4", video: true },
];

export function useDiaryBackground(relationshipId: string, scope = "diary") {
  const home = useHomeBackground();
  const key = scope === "diary" ? `lyrebird-resonance-background:${relationshipId}` : `lyrebird-resonance-${scope}-background:${relationshipId}`;
  const [selected, setSelected] = useState("follow-home");
  const [upload, setUpload] = useState<BackgroundMedia>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    let url: string | undefined;
    const load = async () => {
      try {
        const saved = localStorage.getItem(key) ?? "follow-home";
        const blob = await readBackgroundUpload(key);
        if (!active) return;
        const media = blob ? createBackgroundMedia(blob) : undefined;
        url = media?.url;
        setUpload(media);
        setSelected(saved);
        setError("");
      } catch { if (active) setError("背景读取失败，请刷新重试。"); }
      finally { if (active) setBusy(false); }
    };
    void load();
    const onStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) setRevision((value) => value + 1); };
    window.addEventListener("storage", onStorage);
    return () => { active = false; if (url) URL.revokeObjectURL(url); window.removeEventListener("storage", onStorage); };
  }, [key, revision]);
  const select = (id: string) => {
    if (busy) return;
    try { localStorage.setItem(key, id); setSelected(id); setError(""); }
    catch { setError("背景保存失败，请检查浏览器存储权限。"); }
  };
  const changeUpload = async (file?: File) => {
    if (busy) return;
    if (file && !isBackgroundFile(file)) { setError(`请选择 ${backgroundFormatHint} 文件。`); return; }
    setBusy(true); setError("");
    try {
      await writeBackgroundUpload(key, file);
      localStorage.setItem(key, file ? "custom" : selected === "custom" ? "follow-home" : selected);
      setRevision((value) => value + 1);
    } catch { setError("背景保存失败，请检查浏览器存储空间。"); setBusy(false); }
  };
  const media = selected === "custom" ? upload ?? home : presets.find((preset) => preset.id === selected) ?? home;
  return { media, selected, upload, busy, error, select, changeUpload };
}

export function DiaryBackgroundSettings({ settings }: { settings: ReturnType<typeof useDiaryBackground> }) {
  return <section aria-label="日记背景设置">
    <p className="res-hint">选择此页面的背景，设置后自动保存。</p>
    <fieldset className="res-background-controls" disabled={settings.busy}>
      <FollowHomeButton active={settings.selected === "follow-home"} onSelect={() => settings.select("follow-home")} />
      <label className="res-secondary">{settings.busy ? "处理中…" : "上传背景"}<input className="visually-hidden" aria-label="上传日记背景" type="file" accept={backgroundAccept} disabled={settings.busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void settings.changeUpload(file); event.target.value = ""; }} /></label>
      <p className="res-hint">{backgroundFormatHint}</p>
      <div className="res-background-gallery">
        {presets.map((preset) => <button key={preset.id} className="res-background-choice" type="button" aria-label={`使用${preset.name}背景`} aria-pressed={settings.selected === preset.id} onClick={() => settings.select(preset.id)}><span className="relative" style={{ backgroundImage: backgroundImage(preset) }}><BackgroundVideo media={preset} preview />{settings.selected === preset.id && <Check className="relative" size={20} />}</span><small>{preset.name}</small></button>)}
        {settings.upload && <button className="res-background-choice" type="button" aria-label="使用已上传背景" aria-pressed={settings.selected === "custom"} onClick={() => settings.select("custom")}><span className="relative" style={{ backgroundImage: backgroundImage(settings.upload) }}><BackgroundVideo media={settings.upload} preview />{settings.selected === "custom" && <Check className="relative" size={20} />}</span><small>已上传背景</small></button>}
      </div>
      {settings.upload && <button className="res-text-button" type="button" onClick={() => void settings.changeUpload()}>删除已上传背景</button>}
    </fieldset>
    {settings.error && <p className="res-error" role="alert">{settings.error}</p>}
  </section>;
}
