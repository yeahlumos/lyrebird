"use client";

import { useState } from "react";
import { memberName, type Member } from "./store";

export type Avatars = Partial<Record<Member, string>>;

export function Avatar({ member, src }: { member: Member; src?: string }) {
  return <span className={`res-avatar res-${member}`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {src ? <img src={src} alt={`${memberName(member)}的头像`} /> : memberName(member)}
  </span>;
}

export function AvatarUpload({ member, value, onChange }: { member: Member; value?: string; onChange: (value: string | undefined) => void }) {
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
        canvas.width = canvas.height = 256;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        const size = Math.min(image.width, image.height);
        context.drawImage(image, (image.width - size) / 2, (image.height - size) / 2, size, size, 0, 0, 256, 256);
        onChange(canvas.toDataURL("image/webp", 0.85));
      } finally { image.close(); }
    } catch { setError("头像读取失败，请尝试其他图片。"); }
    finally { setBusy(false); }
  };
  return <div className="res-avatar-upload"><Avatar member={member} src={value} /><label className="res-secondary">{busy ? "处理中…" : `${value ? "更换" : "上传"}${memberName(member)}的头像`}<input className="visually-hidden" aria-label={`上传${memberName(member)}的头像`} type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} /></label>{value && <button className="res-text-button" type="button" disabled={busy} onClick={() => onChange(undefined)}>移除</button>}{error && <p className="res-error" role="alert">{error}</p>}</div>;
}
