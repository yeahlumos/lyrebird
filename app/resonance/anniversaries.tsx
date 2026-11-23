"use client";

import SettingsButton from "../_ui/settings-button";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Heart, Pencil, Plus, Trash2, X } from "lucide-react";
import { BackgroundVideo, backgroundImage } from "../_background/media";
import { DiaryBackgroundSettings, useDiaryBackground } from "./diary-background";
import CardBackground from "./card-background";
import { CompanionBalls } from "./companions";
import PetAnimation from "./pet-animation";
import { dateKey, findRelationship, fromKey, milestoneOccurrence, validDate, type Commit, type Milestone, type Relationship } from "./store";
import "./anniversaries.css";

export default function Anniversaries({ relationship, commit, error }: { relationship: Relationship; commit: Commit; error: string }) {
  const [now, setNow] = useState(() => new Date());
  const [draft, setDraft] = useState<Milestone | null>(null);
  const [backgroundOpen, setBackgroundOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const backgroundDialog = useRef<HTMLDialogElement>(null);
  const background = useDiaryBackground(relationship.id, "anniversaries");
  const pet = relationship.pet ?? { name: "heixiu", feeds: 0 };
  const today = dateKey(now);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 15_000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (draft) dialog.current?.showModal(); }, [draft]);
  useEffect(() => { if (backgroundOpen) backgroundDialog.current?.showModal(); }, [backgroundOpen]);
  const events = (relationship.milestones ?? []).map((item) => {
    let occurrence = milestoneOccurrence(item, now);
    if (item.yearly && dateKey(occurrence) < today) {
      const next = new Date(now); next.setFullYear(now.getFullYear() + 1);
      occurrence = milestoneOccurrence(item, next);
    }
    const currentDay = fromKey(today);
    const days = Math.round((Date.UTC(occurrence.getFullYear(), occurrence.getMonth(), occurrence.getDate()) - Date.UTC(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate())) / 86400000);
    return { item, occurrence, days };
  }).sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime());
  const save = () => {
    if (!draft?.title.trim() || !validDate(draft.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) return;
    if (commit((store) => { const current = findRelationship(store, relationship.id); current.milestones = [...(current.milestones ?? []).filter((item) => item.id !== draft.id), { ...draft, title: draft.title.trim() }]; })) setDraft(null);
  };
  return <main className="res-anniversary-page relative isolate" style={{ backgroundImage: backgroundImage(background.media) }}>
    {background.media.video && <div className="pointer-events-none fixed inset-0 -z-10"><BackgroundVideo media={background.media} /></div>}
    <nav><Link className="res-back-link" href={`/resonance/${relationship.id}`}><ArrowLeft size={18} />返回双人日记</Link><span>HEIXIU / 纪念日</span><SettingsButton aria-label="纪念日页面背景设置" title="背景设置" onClick={() => setBackgroundOpen(true)} /></nav>
    <header className="res-anniversary-intro"><PetAnimation /><div><h1>{pet.name} 的纪念日</h1><p>陪伴等级 Lv.{1 + Math.floor(pet.feeds / 7)} · 已喂养 {pet.feeds} 天</p><button className="res-secondary" disabled={pet.fedOn === today} onClick={() => commit((store) => { const current = findRelationship(store, relationship.id); const value = current.pet ?? { name: "heixiu", feeds: 0 }; if (value.fedOn !== today) current.pet = { ...value, fedOn: today, feeds: value.feeds + 1 }; })}><Heart size={16} />{pet.fedOn === today ? "今天已喂养" : "喂一颗爱心"}</button></div><label className="res-anniversary-name">宠物名字<input maxLength={12} value={pet.name} onChange={(event) => commit((store) => { const current = findRelationship(store, relationship.id); current.pet = { ...(current.pet ?? { feeds: 0 }), name: event.target.value }; })} /></label></header>
    <section className="res-anniversary-cards" aria-label="纪念日卡片">
      {events.map(({ item, occurrence, days }) => <article key={item.id} className={`res-anniversary-card${item.background ? " res-anniversary-card-photo" : ""}`} style={item.background ? { backgroundImage: `linear-gradient(180deg, #102c2955, #102c2999), url("${item.background}")` } : undefined}>
        <header style={item.headerColor ? { backgroundColor: item.headerColor, color: headerTextColor(item.headerColor) } : undefined}><h2>{item.title}</h2><span>{days > 0 ? "还有" : days < 0 ? "已经" : "就是今天"}</span></header>
        <div className="res-anniversary-number"><strong>{Math.abs(days)}</strong><span>天</span></div>
        <footer><time dateTime={dateKey(occurrence)}>{occurrence.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</time><small>{item.time}{item.yearly ? " · 每年提醒" : ""}</small></footer>
        <div className="res-anniversary-tools" style={item.headerColor ? { color: headerTextColor(item.headerColor) } : undefined}><button className="res-icon" aria-label={`编辑${item.title}`} onClick={() => setDraft({ ...item })}><Pencil size={15} /></button><button className="res-icon" aria-label={`删除${item.title}`} onClick={() => { if (window.confirm("删除这个纪念日？")) commit((store) => { const current = findRelationship(store, relationship.id); current.milestones = current.milestones?.filter((entry) => entry.id !== item.id); }); }}><Trash2 size={15} /></button></div>
      </article>)}
      <button className="res-add-card res-anniversary-add" type="button" onClick={() => setDraft({ id: crypto.randomUUID(), title: "", date: today, time: "09:00", yearly: true })}><span><Plus size={27} /></span><strong>添加纪念日</strong></button>
    </section>
    <p className="res-anniversary-note">按本机时间提醒。打开共鸣时到点提醒，重新进入会补提醒。</p>
    {error && <p className="res-error" role="alert">{error}</p>}
    {draft && <dialog ref={dialog} className="res-dialog" aria-label="纪念日设置" onCancel={() => setDraft(null)}><div className="res-dialog-head"><h2>纪念日设置</h2><button className="res-icon" aria-label="关闭纪念日设置" onClick={() => setDraft(null)}><X size={20} /></button></div><form onSubmit={(event) => { event.preventDefault(); save(); }}>
      <label className="res-field">事件名称<input required maxLength={80} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <div className="res-event-dates"><label className="res-field">日期<input type="date" required value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value, notified: undefined })} /></label><label className="res-field">提醒时间<input type="time" required value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value, notified: undefined })} /></label></div>
      <label><input type="checkbox" checked={draft.yearly} onChange={(event) => setDraft({ ...draft, yearly: event.target.checked, notified: undefined })} />每年提醒</label>
      <div className="res-anniversary-color"><label>顶部颜色<input type="color" value={draft.headerColor ?? "#5b867c"} onChange={(event) => setDraft({ ...draft, headerColor: event.target.value })} /></label><button className="res-text-button" type="button" onClick={() => setDraft({ ...draft, headerColor: undefined })}>恢复默认</button></div>
      <div className="res-anniversary-color-preview" style={{ backgroundColor: draft.headerColor ?? "#5b867c", color: headerTextColor(draft.headerColor ?? "#5b867c") }}>{draft.title || "事件名称"}</div>
      <CardBackground value={draft.background} onChange={(value) => setDraft({ ...draft, background: value })} />
      {error && <p className="res-error" role="alert">{error}</p>}
      <div className="res-actions"><button className="res-secondary" type="button" onClick={() => setDraft(null)}>取消</button><button className="res-primary" type="submit">保存纪念日</button></div>
    </form></dialog>}
    {backgroundOpen && <dialog ref={backgroundDialog} className="res-dialog" aria-label="纪念日页面背景" onCancel={() => setBackgroundOpen(false)}><div className="res-dialog-head"><h2>纪念日页面背景</h2><button className="res-icon" aria-label="关闭背景设置" onClick={() => setBackgroundOpen(false)}><X size={20} /></button></div><DiaryBackgroundSettings settings={background} /></dialog>}
    <CompanionBalls relationship={relationship} commit={commit} error={error} hidePet />
  </main>;
}

function headerTextColor(color: string) {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(color.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? "#142a24" : "#ffffff";
}
