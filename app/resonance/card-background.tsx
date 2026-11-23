"use client";

import { useState } from "react";

export default function CardBackground({ value, onChange }: { value?: string; onChange: (value?: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const upload = async (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) { setError("请选择 JPG、PNG、WebP 或 GIF 图片。"); return; }
    if (file.size > 10 * 1024 * 1024) { setError("请选择不超过 10 MB 的图片。"); return; }
    setBusy(true); setError("");
    try {
      const image = await createImageBitmap(file);
      try {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        onChange(canvas.toDataURL("image/webp", 0.82));
      } finally { image.close(); }
    } catch { setError("背景图片读取失败，请尝试其他图片。"); }
    finally { setBusy(false); }
  };
  return <>
    <p className="res-muted">为这张关系卡片选择背景图片，上传后自动保存。</p>
    {value && <div className="res-card-background-preview" style={{ backgroundImage: `linear-gradient(180deg, #10241b20, #10241b99), url("${value}")` }}><span>卡片背景预览</span></div>}
    <label className="res-secondary">{busy ? "处理中…" : value ? "更换背景" : "上传背景"}<input className="visually-hidden" aria-label="上传卡片背景" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} /></label>
    {value && <button type="button" className="res-text-button res-remove-background" disabled={busy} onClick={() => onChange(undefined)}>移除背景</button>}
    {error && <p className="res-error" role="alert">{error}</p>}
  </>;
}
