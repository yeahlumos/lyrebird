"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import StarlitBall from "./starlit-ball";
import CompletionStars from "./completion-stars";
import PetAnimation from "./pet-animation";
import DraggablePet from "./draggable-pet";
import { completeWish, dateKey, findRelationship, milestoneOccurrence, validDate, type Commit, type Member, type Milestone, type Relationship, type Wish } from "./store";
import "./companions.css";

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="res-dialog" onCancel={(e) => { e.preventDefault(); onClose(); }} aria-label={title}>
    <div className="res-dialog-head"><h2>{title}</h2><button className="res-icon" aria-label="关闭" onClick={onClose}><X size={20} /></button></div>{children}
  </dialog>;
}

export function CompanionBalls({ relationship, commit, hidePet = false }: { relationship: Relationship; commit: Commit; error: string; hidePet?: boolean }) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [reminders, setReminders] = useState<Milestone[]>([]);
  const pet = relationship.pet ?? { name: "heixiu", feeds: 0 };
  useEffect(() => {
    if (relationship.pet?.name !== "小琴") return;
    commit((store) => {
      const current = findRelationship(store, relationship.id);
      if (current.pet?.name === "小琴") current.pet.name = "heixiu";
    });
  }, [relationship.id, relationship.pet?.name, commit]);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = window.setInterval(tick, 15_000);
    window.addEventListener("focus", tick);
    return () => { clearInterval(timer); window.removeEventListener("focus", tick); };
  }, []);
  useEffect(() => {
    const due = (relationship.milestones ?? []).filter((item) => {
      const occurrence = milestoneOccurrence(item, now);
      return occurrence.getTime() <= now.getTime() && (!item.yearly || occurrence.getFullYear() >= Number(item.date.slice(0, 4))) && item.notified !== dateKey(occurrence);
    });
    if (!due.length) return;
    const shown: Milestone[] = [];
    if (commit((store) => {
      const current = findRelationship(store, relationship.id);
      for (const item of current.milestones ?? []) {
        const occurrence = milestoneOccurrence(item, now);
        if (due.some((entry) => entry.id === item.id) && item.notified !== dateKey(occurrence)) {
          item.notified = dateKey(occurrence);
          shown.push({ ...item });
        }
      }
    }) && shown.length) queueMicrotask(() => setReminders((current) => [...current, ...shown]));
  }, [now, relationship, commit]);

  return <>
    {!hidePet && <div className="res-companions" aria-label="双人日记小助手"><DraggablePet name={pet.name} onOpen={() => router.push(`/resonance/${relationship.id}/anniversaries`)} celebrating={reminders.length > 0} /></div>}
    <StarlitBall relationshipId={relationship.id} />
    {reminders.length > 0 && <Dialog title={`${pet.name} 有话告诉你`} onClose={() => setReminders([])}><div className="res-pet-reminder"><PetAnimation celebrating /></div>{reminders.map((item) => <p key={item.id} className="res-muted"><Bell size={16} />「{item.title}」的日子到了。给彼此留一点温柔的时间吧。</p>)}<button className="res-primary res-full" onClick={() => setReminders([])}>记住啦</button></Dialog>}
  </>;
}

export function BucketList({ relationship, commit, error }: { relationship: Relationship; commit: Commit; error: string }) {
  const [title, setTitle] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [completing, setCompleting] = useState<Wish | null>(null);
  const [date, setDate] = useState(() => dateKey(new Date()));
  const [linkDiary, setLinkDiary] = useState(true);
  const [actor, setActor] = useState<Member>("self");
  const [note, setNote] = useState("");
  const completionTarget = useRef<HTMLButtonElement | null>(null);
  const [celebration, setCelebration] = useState<{ x: number; y: number; id: string } | null>(null);
  const clearCelebration = useCallback(() => setCelebration(null), []);
  const wishes = relationship.wishes ?? [];
  const complete = () => {
    if (!completing || !validDate(date)) return;
    const bounds = completionTarget.current?.getBoundingClientRect();
    if (commit((store) => {
      const current = findRelationship(store, relationship.id);
      completeWish(current, completing.id, date, actor, linkDiary, note);
    })) {
      setCompleting(null);
      if (bounds) setCelebration({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2, id: crypto.randomUUID() });
    }
  };
  const done = wishes.filter((item) => item.completedAt).length;
  return <main className="res-bucket-page">
    <nav><Link className="res-back-link" href={`/resonance/${relationship.id}`}><ArrowLeft size={18} />返回双人日记</Link><span>RESONANCE / BUCKET LIST</span></nav>
    <header><span className="res-eyebrow">DREAM TOGETHER</span><p>完成 {done} / {wishes.length} 个心愿</p><progress value={done} max={Math.max(1, wishes.length)} aria-label="心愿完成进度" /></header>
    <form className="res-wish-add" onSubmit={(e) => { e.preventDefault(); if (!title.trim()) return; if (commit((store) => { const current = findRelationship(store, relationship.id); if (editing) { const item = current.wishes?.find((wish) => wish.id === editing); if (item) item.title = title.trim(); } else current.wishes = [...(current.wishes ?? []), { id: crypto.randomUUID(), title: title.trim(), createdAt: new Date().toISOString() }]; })) { setTitle(""); setEditing(null); } }}><input aria-label="心愿内容" maxLength={200} required placeholder="一起去看海、做一顿晚餐，或完成一个小梦想…" value={title} onChange={(e) => setTitle(e.target.value)} /><button className="res-primary"><Plus size={17} />{editing ? "保存" : "添加"}</button>{editing && <button type="button" className="res-secondary" onClick={() => { setEditing(null); setTitle(""); }}>取消</button>}</form>
    <div className="res-tabs res-wish-tabs">{[["all", "全部"], ["pending", "想做的"], ["done", "已完成"]].map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
    <section className="res-wishes" aria-label="共同心愿">{wishes.filter((item) => filter === "all" || (filter === "done" ? Boolean(item.completedAt) : !item.completedAt)).map((item) => <article key={item.id} className={item.completedAt ? "done" : ""}>
      <button className="res-wish-check" disabled={Boolean(item.completedAt)} aria-label={item.completedAt ? "心愿已完成" : `完成${item.title}`} onClick={(event) => { completionTarget.current = event.currentTarget; setCompleting(item); setDate(dateKey(new Date())); setNote(""); setLinkDiary(true); }}>{item.completedAt && <Check size={18} />}</button>
      <div><h2>{item.title}</h2>{item.completedAt && <small>完成于 {item.completedAt}</small>}{item.diaryDate && <Link href={`/resonance/${relationship.id}?date=${item.diaryDate}`}>查看当天日记 →</Link>}</div>
      <button className="res-icon" aria-label={`编辑心愿${item.title}`} onClick={() => { setEditing(item.id); setTitle(item.title); }}><Pencil size={15} /></button><button className="res-icon" aria-label={`删除心愿${item.title}`} onClick={() => { if (window.confirm("删除这个心愿？关联的日记会保留。")) commit((store) => { const current = findRelationship(store, relationship.id); current.wishes = current.wishes?.filter((wish) => wish.id !== item.id); }); }}><Trash2 size={15} /></button>
    </article>)}</section>
    {!wishes.length && <p className="res-muted">从一个小小的心愿开始，慢慢填满属于你们的清单。</p>}{error && <p className="res-error" role="alert">{error}</p>}
    <CompanionBalls relationship={relationship} commit={commit} error={error} />
    {celebration && <CompletionStars key={celebration.id} x={celebration.x} y={celebration.y} onEnd={clearCelebration} />}
    {completing && <Dialog title="又一起完成了一件事" onClose={() => setCompleting(null)}><p className="res-muted">{completing.title}</p><label className="res-field">完成日期<input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label><label><input type="checkbox" checked={linkDiary} onChange={(e) => setLinkDiary(e.target.checked)} /> 关联并记入当天双人日记</label>{linkDiary && <><label className="res-field">记录身份<select value={actor} onChange={(e) => setActor(e.target.value as Member)}><option value="self">我</option><option value="other">对方</option></select></label><label className="res-field">留一点完成时的心情<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="这一刻，想记住什么？" /></label></>}<div className="res-actions"><button className="res-primary" disabled={!validDate(date)} onClick={complete}>确认完成</button></div>{error && <p className="res-error" role="alert">{error}</p>}</Dialog>}
  </main>;
}

