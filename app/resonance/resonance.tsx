"use client";

import SettingsButton from "../_ui/settings-button";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Copy, Heart, ImagePlus, MessageCircle, Orbit, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { BackgroundVideo, backgroundImage } from "../_background/media";
import { acceptInvite, createInvite, dateKey, draftPrefix, findRelationship, fromKey, kindName, memberName, ownPost, readStore, storageKey, timeLabel, type Member, type Post, type Relationship, type RelationshipKind, type Store } from "./store";
import { deleteImages, readImage, saveImages } from "./images";
import { CompanionBalls, BucketList } from "./companions";
import { Avatar, AvatarUpload, type Avatars } from "./avatar";
import CardBackground from "./card-background";
import Anniversaries from "./anniversaries";
import { DiaryBackgroundSettings, useDiaryBackground } from "./diary-background";
import "./resonance.css";

type Commit = (change: (store: Store) => void) => boolean;
type Draft = { text: string; images: string[] };
const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "操作失败，请重试。";

function useResonanceStore() {
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const refresh = () => {
      try { setStore(readStore()); setError(""); }
      catch { setError("本地共鸣记录读取失败，原数据已保留。请检查浏览器存储权限后刷新。"); }
    };
    queueMicrotask(refresh);
    const onStorage = (event: StorageEvent) => { if (event.key === storageKey || event.key === null) refresh(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const commit: Commit = (change) => {
    try {
      // Re-read before each change so another tab's saved records are preserved.
      const next = readStore();
      change(next);
      localStorage.setItem(storageKey, JSON.stringify(next));
      setStore(next);
      setError("");
      return true;
    } catch (reason) {
      setError(reason instanceof DOMException ? "保存失败，请检查浏览器存储权限或剩余空间。" : errorMessage(reason));
      return false;
    }
  };
  return { store, error, commit };
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = overflow; };
  }, []);
  return <dialog ref={ref} className={`res-dialog ${wide ? "res-dialog-wide" : ""}`} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="res-dialog-head"><h2 id={titleId}>{title}</h2><button className="res-icon" type="button" aria-label="关闭弹窗" onClick={onClose}><X size={20} /></button></div>
    {children}
  </dialog>;
}

function Photo({ id, onOpen }: { id: string; onOpen?: (url: string) => void }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    readImage(id).then((blob) => {
      if (!active) return;
      if (!blob) { setFailed(true); return; }
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id]);
  if (!url) return <span className="res-photo-placeholder">{failed ? "图片暂无法读取" : "图片加载中…"}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <button type="button" className="res-photo" onClick={() => onOpen?.(url)} aria-label="放大日记配图"><img src={url} alt="双人日记配图" /></button>;
}

function Invitation({ store, commit, error, onClose, onBound }: { store: Store; commit: Commit; error: string; onClose: () => void; onBound: () => void }) {
  const [kind, setKind] = useState<RelationshipKind>("partner");
  const [mode, setMode] = useState<"join" | "invite">("join");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const pending = Object.entries(store.invites).filter(([, value]) => !value.relationshipId && value.kind === kind).at(-1)?.[0];
  const [avatarEdits, setAvatarEdits] = useState<Avatars | null>(null);
  const avatars = avatarEdits ?? (pending ? store.invites[pending].avatars : undefined) ?? {};
  const changeAvatar = (member: Member, value: string | undefined) => {
    const next = { ...avatars };
    if (value) next[member] = value; else delete next[member];
    setAvatarEdits(next);
    if (pending) commit((store) => { if (store.invites[pending] && !store.invites[pending].relationshipId) store.invites[pending].avatars = next; });
  };
  const bind = (value: string) => {
    if (commit((next) => { const relationship = acceptInvite(next, value, kind); if (avatarEdits !== null) relationship.avatars = { ...relationship.avatars, ...avatars }; })) onBound();
  };
  return <Modal title="开启一份共鸣" onClose={onClose}>
    <p className="res-muted">选择你们的关系，邀请一个人一起记录生活。</p>
    <fieldset className="res-kind"><legend>你们的关系</legend>
      <button type="button" className={kind === "partner" ? "selected" : ""} aria-pressed={kind === "partner"} onClick={() => { setKind("partner"); setNotice(""); }}><Heart size={22} />伴侣<span>收藏两个人的日常</span></button>
      <button type="button" className={kind === "friend" ? "selected" : ""} aria-pressed={kind === "friend"} onClick={() => { setKind("friend"); setNotice(""); }}><Users size={22} />朋友<span>分享彼此的小世界</span></button>
    </fieldset>
    <p className="res-hint">设置头像（可选，绑定后也能更换）</p>
    <AvatarUpload member="self" value={avatars.self} onChange={(value) => changeAvatar("self", value)} />
    <AvatarUpload member="other" value={avatars.other} onChange={(value) => changeAvatar("other", value)} />
    <div className="res-tabs" role="group" aria-label="邀请方式">
      <button type="button" aria-pressed={mode === "join"} onClick={() => setMode("join")}>填写邀请码</button>
      <button type="button" aria-pressed={mode === "invite"} onClick={() => setMode("invite")}>生成邀请码</button>
    </div>
    {mode === "join" ? <form onSubmit={(event) => { event.preventDefault(); bind(code); }}>
      <label className="res-field">邀请码<input autoComplete="off" maxLength={32} placeholder="输入邀请码" value={code} onChange={(event) => setCode(event.target.value)} /></label>
      <p className="res-hint">试一试虚拟邀请码：<button className="res-text-button" type="button" onClick={() => setCode("LYRE2026")}>LYRE2026</button>（仅可绑定一次）</p>
      <button className="res-primary res-full" type="submit" disabled={!code.trim()}>确认绑定并创建卡片<ArrowRight size={17} /></button>
    </form> : <div>
      {pending ? <>
        <p className="res-hint">等待对方接受 · {kindName(kind)}邀请</p>
        <div className="res-invite-code"><strong>{pending}</strong><button className="res-icon" type="button" aria-label="复制邀请码" onClick={async () => { try { await navigator.clipboard.writeText(pending); setNotice("邀请码已复制"); } catch { setNotice("复制失败，请选中邀请码手动复制。"); } }}><Copy size={18} /></button></div>
        <p className="res-hint">绑定成功后才会创建关系卡片。当前可在本浏览器另一标签页填写此码，或模拟对方接受。</p>
        <button className="res-primary res-full" type="button" onClick={() => bind(pending)}>模拟对方接受邀请<Check size={17} /></button>
      </> : <button className="res-primary res-full" type="button" onClick={() => { commit((next) => { const code = createInvite(next, kind); next.invites[code].avatars = avatars; }); }}>生成{kindName(kind)}邀请码<Plus size={17} /></button>}
    </div>}
    {notice && <p className="res-hint" role="status">{notice}</p>}
    {error && <p className="res-error" role="alert">{error}</p>}
    <p className="res-test-note">本地测试：邀请码与日记仅保存在当前浏览器，暂不支持跨设备绑定。</p>
  </Modal>;
}

function RelationshipList({ store, commit, error }: { store: Store; commit: Commit; error: string }) {
  const [adding, setAdding] = useState(false);
  const [backgroundId, setBackgroundId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Relationship | null>(null);
  const [notice, setNotice] = useState("");
  const remove = async () => {
    if (!deleting) return;
    const id = deleting.id;
    if (!commit((next) => { next.relationships = next.relationships.filter((item) => item.id !== id); })) return;
    setDeleting(null);
    setNotice("关系卡片已删除");
    try {
      for (const key of Object.keys(localStorage)) if (key.startsWith(`${draftPrefix}${id}:`)) localStorage.removeItem(key);
      await deleteImages([], id);
    } catch { setNotice("卡片已删除，部分本地图片或草稿未能清理。"); }
  };
  return <main className="res-list-page">
    <nav className="res-list-nav"><Link className="res-back-link" href="/"><ArrowLeft size={18} />返回主页</Link><span>LYREBIRD / RESONANCE</span></nav>
    <header className="res-list-header"><p className="res-eyebrow">RESONANCE / 共鸣</p></header>
    <div className="res-test-banner"><Orbit size={18} /><p>本地体验版 · 使用虚拟邀请码绑定，在日记内切换双方身份测试。记录会保存在当前浏览器。</p></div>
    {error && <p className="res-error" role="alert">{error}</p>}
    {notice && <p className="res-hint" role="status">{notice}</p>}
    <section className="res-cards" aria-label="我的关系卡片">
      {store.relationships.map((relationship) => {
        const Icon = relationship.kind === "partner" ? Heart : Users;
        const lastPost = relationship.posts.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        return <article key={relationship.id} className={`res-card res-card-${relationship.kind}${relationship.cardBackground ? " res-card-with-background" : ""}`} style={relationship.cardBackground ? { backgroundImage: `linear-gradient(180deg, rgba(13,31,24,.28), rgba(13,31,24,.74)), url("${relationship.cardBackground}")` } : undefined}>
          <Link href={`/resonance/${relationship.id}`} className="res-card-link">
            <div className="res-card-top"><span className="res-card-symbol"><Icon size={25} strokeWidth={1.5} /></span><span className="res-pill">{kindName(relationship.kind)} · 已绑定</span></div>
            <div className="res-pair"><Avatar member="self" src={relationship.avatars?.self} /><span className="res-pair-line" /><Avatar member="other" src={relationship.avatars?.other} /></div>
            <h2>我与{kindName(relationship.kind)}的日记</h2><p className="res-card-excerpt">{lastPost ? lastPost.text || "分享了一些照片" : "还没有记录，从今天的第一句话开始。"}</p>
            <div className="res-card-foot"><span>{relationship.posts.length} 条日记 · {new Set(relationship.posts.map((post) => post.date)).size} 个有记录的日子</span><ArrowRight size={19} /></div>
          </Link>
          <button className="res-card-delete res-icon" type="button" aria-label={`删除${kindName(relationship.kind)}关系卡片`} title="删除关系卡片" onClick={() => setDeleting(relationship)}><Trash2 size={16} /></button>
          <SettingsButton className="res-card-background-button" aria-label={`设置${kindName(relationship.kind)}卡片背景`} title="设置卡片背景" onClick={() => setBackgroundId(relationship.id)} />
        </article>;
      })}
      <button className="res-add-card" type="button" onClick={() => setAdding(true)}><span><Plus size={27} strokeWidth={1.3} /></span><strong>{store.relationships.length ? "再开启一份共鸣" : "开启第一份共鸣"}</strong><small>选择关系 · 邀请对方 · 一起记录</small></button>
    </section>
    {adding && <Invitation store={store} commit={commit} error={error} onClose={() => setAdding(false)} onBound={() => { setAdding(false); setNotice("绑定成功，双人日记卡片已创建。"); }} />}
    {backgroundId && store.relationships.some((item) => item.id === backgroundId) && <Modal title="卡片背景" onClose={() => setBackgroundId(null)}>
      <CardBackground key={backgroundId} value={store.relationships.find((item) => item.id === backgroundId)?.cardBackground} onChange={(value) => {
        commit((next) => { const relationship = findRelationship(next, backgroundId); if (value) relationship.cardBackground = value; else delete relationship.cardBackground; });
      }} />
      {error && <p className="res-error" role="alert">{error}</p>}
    </Modal>}
    {deleting && <Modal title="删除这张关系卡片？" onClose={() => setDeleting(null)}><p className="res-muted">这会删除此卡片中的双方日记、回复和配图，无法恢复。其他关系卡片不受影响。</p>{error && <p className="res-error" role="alert">{error}</p>}<div className="res-actions"><button className="res-secondary" type="button" onClick={() => setDeleting(null)}>取消</button><button className="res-danger" type="button" onClick={() => void remove()}>确认删除卡片</button></div></Modal>}
  </main>;
}

function Editor({ relationship, actor, date, post, commit, error, onClose, onPreview }: { relationship: Relationship; actor: Member; date: string; post?: Post; commit: Commit; error: string; onClose: () => void; onPreview: (url: string) => void }) {
  const key = `${draftPrefix}${relationship.id}:${actor}:${date}:${post?.id ?? "new"}`;
  const [localError, setLocalError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [status, setStatus] = useState("草稿会自动保存在本地");
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const raw = localStorage.getItem(key);
      const saved = raw ? JSON.parse(raw) as Draft : null;
      if (saved && typeof saved.text === "string" && Array.isArray(saved.images) && saved.images.every((id) => typeof id === "string")) return saved;
    } catch { /* The saved post remains available if a draft cannot be read. */ }
    return { text: post?.text ?? "", images: post?.images ?? [] };
  });
  const draftRef = useRef(draft);
  const update = (next: Draft) => {
    draftRef.current = next;
    setDraft(next);
    try { localStorage.setItem(key, JSON.stringify(next)); setStatus("草稿已自动保存"); setLocalError(""); }
    catch { setLocalError("草稿保存失败，请先复制文字备份，再检查浏览器存储空间。"); }
  };
  const upload = async (files: File[]) => {
    if (busyRef.current || !files.length) return;
    if (files.some((file) => !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type))) { setLocalError("请选择 JPG、PNG、WebP 或 GIF 图片。"); return; }
    busyRef.current = true;
    setBusy(true);
    setLocalError("");
    try { const ids = await saveImages(relationship.id, files); update({ ...draftRef.current, images: [...draftRef.current.images, ...ids] }); }
    catch { setLocalError("图片保存失败，请检查浏览器存储空间。"); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const save = () => {
    if (busyRef.current || (!draft.text.trim() && !draft.images.length)) return;
    const success = commit((next) => {
      const current = findRelationship(next, relationship.id);
      if (post) {
        const original = ownPost(current, post.id, actor);
        original.text = draft.text.trim();
        original.images = draft.images;
        original.updatedAt = new Date().toISOString();
      } else {
        current.posts.unshift({ id: crypto.randomUUID(), date, author: actor, text: draft.text.trim(), images: draft.images, createdAt: new Date().toISOString(), replies: [] });
      }
    });
    if (!success) return;
    try { localStorage.removeItem(key); } catch { /* The published entry is already saved. */ }
    onClose();
  };
  return <Modal title={post ? "编辑我的日记" : "写一条日记"} wide onClose={() => { if (!busyRef.current) onClose(); }}>
    <div className="res-editor-meta"><span className={`res-author res-${actor}`}><span className="res-dot" />{memberName(actor)}正在书写</span><time>{date}</time></div>
    <form onSubmit={(event) => { event.preventDefault(); save(); }}>
      <label className="res-field"><span className="visually-hidden">日记内容</span><textarea autoFocus aria-label="日记内容" placeholder="今天有什么想与对方分享的？" value={draft.text} onChange={(event) => update({ ...draftRef.current, text: event.target.value })} onPaste={(event) => { const files = Array.from(event.clipboardData.files); if (files.length) { event.preventDefault(); void upload(files); } }} /></label>
      <div className="res-upload" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void upload(Array.from(event.dataTransfer.files)); }}>
        <label className="res-secondary"><ImagePlus size={17} />添加图片<input className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple disabled={busy} onChange={(event) => { void upload(Array.from(event.target.files ?? [])); event.target.value = ""; }} /></label><span>也可以拖入或粘贴图片</span>
      </div>
      {draft.images.length > 0 && <div className="res-photos">{draft.images.map((id) => <div className="res-draft-photo" key={id}><Photo id={id} onOpen={onPreview} /><button className="res-icon" aria-label="移除配图" type="button" disabled={busy} onClick={() => update({ ...draftRef.current, images: draftRef.current.images.filter((image) => image !== id) })}><X size={15} /></button></div>)}</div>}
      {(localError || error) && <p className="res-error" role="alert">{localError || error}</p>}
      <div className="res-editor-footer"><span role="status">{busy ? "图片保存中…" : status}</span><button className="res-primary" type="submit" disabled={busy || (!draft.text.trim() && !draft.images.length)}>保存日记<Check size={16} /></button></div>
    </form>
  </Modal>;
}

function ReplyForm({ relationshipId, postId, actor, commit }: { relationshipId: string; postId: string; actor: Member; commit: Commit }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  return open ? <form className="res-reply-form" onSubmit={(event) => {
    event.preventDefault();
    if (!text.trim()) return;
    if (commit((next) => {
      const post = findRelationship(next, relationshipId).posts.find((item) => item.id === postId);
      if (!post) throw new Error("这条日记已被删除，无法回复。");
      post.replies.push({ id: crypto.randomUUID(), author: actor, text: text.trim(), createdAt: new Date().toISOString() });
    })) { setText(""); setOpen(false); }
  }}><label className="visually-hidden" htmlFor={`reply-${postId}`}>回复内容</label><textarea id={`reply-${postId}`} autoFocus placeholder="回应一下此刻的心情…" value={text} onChange={(event) => setText(event.target.value)} /><div className="res-actions"><button className="res-text-button" type="button" onClick={() => setOpen(false)}>收起</button><button className="res-primary" type="submit" disabled={!text.trim()}>发送回复</button></div></form> : <button className="res-text-button res-reply-trigger" type="button" onClick={() => setOpen(true)}><MessageCircle size={15} />回复日记</button>;
}

function SharedDiary({ relationship, commit, error }: { relationship: Relationship; commit: Commit; error: string }) {
  const backgroundSettings = useDiaryBackground(relationship.id);
  const background = backgroundSettings.media;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"avatars" | "background">("avatars");
  const [actor, setActor] = useState<Member>("self");
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [editor, setEditor] = useState<{ post?: Post } | null>(null);
  const [deleting, setDeleting] = useState<{ postId: string; replyId?: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const date = new URLSearchParams(window.location.search).get("date");
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && dateKey(fromKey(date)) === date) {
      queueMicrotask(() => { setSelected(date); setMonth(new Date(fromKey(date).getFullYear(), fromKey(date).getMonth(), 1)); });
    }
  }, []);
  const selectedDate = fromKey(selected);
  const posts = relationship.posts.filter((post) => post.date === selected).toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  const year = month.getFullYear();
  const monthNumber = month.getMonth();
  const today = dateKey(new Date());
  const changeDate = (date: Date) => { setSelected(dateKey(date)); setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); };
  const remove = async () => {
    if (!deleting) return;
    let removedImages: string[] = [];
    const success = commit((next) => {
      const current = findRelationship(next, relationship.id);
      if (deleting.replyId) {
        const post = current.posts.find((item) => item.id === deleting.postId);
        const reply = post?.replies.find((item) => item.id === deleting.replyId);
        if (!post || !reply) throw new Error("这条回复已被删除。");
        if (reply.author !== actor) throw new Error("只能删除自己的回复。");
        post.replies = post.replies.filter((item) => item.id !== deleting.replyId);
      } else {
        const post = ownPost(current, deleting.postId, actor);
        removedImages = post.images;
        current.posts = current.posts.filter((item) => item.id !== post.id);
      }
    });
    if (!success) return;
    setDeleting(null);
    setNotice("已删除");
    try {
      if (!deleting.replyId) {
        for (const key of Object.keys(localStorage)) if (key.startsWith(`${draftPrefix}${relationship.id}:`) && key.endsWith(`:${deleting.postId}`)) localStorage.removeItem(key);
      }
      if (removedImages.length) await deleteImages(removedImages);
    } catch { setNotice("日记已删除，部分本地图片或草稿未能清理。"); }
  };
  return <main className="res-diary-page">
    <aside className="res-sidebar">
      <div className="res-side-top"><Link href="/resonance" className="res-icon" aria-label="返回共鸣卡片"><ArrowLeft size={20} /></Link><span>RESONANCE / 共鸣</span></div>
      <div className="res-side-relation"><span className="res-pill">{kindName(relationship.kind)} · 已绑定</span><h2>我们的双人日记</h2><div className="res-pair"><Avatar member="self" src={relationship.avatars?.self} /><span className="res-pair-line" /><Avatar member="other" src={relationship.avatars?.other} /></div></div>
      <div className="res-calendar-head"><button className="res-icon" type="button" aria-label="上个月" onClick={() => setMonth(new Date(year, monthNumber - 1, 1))}><ChevronLeft size={18} /></button><span>{year}年 {monthNumber + 1}月</span><button className="res-icon" type="button" aria-label="下个月" onClick={() => setMonth(new Date(year, monthNumber + 1, 1))}><ChevronRight size={18} /></button></div>
      <div className="res-calendar" aria-label="双人日记日历">
        {weekdays.map((day) => <span key={day} className="res-weekday">{day}</span>)}
        {Array.from({ length: month.getDay() }, (_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: new Date(year, monthNumber + 1, 0).getDate() }, (_, index) => {
          const key = dateKey(new Date(year, monthNumber, index + 1));
          const authors = new Set(relationship.posts.filter((post) => post.date === key).map((post) => post.author));
          return <button key={key} className={`res-day ${selected === key ? "selected" : ""} ${today === key ? "today" : ""}`} type="button" aria-label={`${key}${authors.size ? "，有日记" : ""}`} aria-pressed={selected === key} aria-current={today === key ? "date" : undefined} onClick={() => changeDate(fromKey(key))}><span>{index + 1}</span><span className="res-day-dots">{authors.has("self") && <i className="res-self" />}{authors.has("other") && <i className="res-other" />}</span></button>;
        })}
      </div>
      <button className="res-secondary res-full res-today" type="button" onClick={() => changeDate(new Date())}>回到今天</button>
      <div className="res-legend"><span><i className="res-dot res-self" />我的日记</span><span><i className="res-dot res-other" />对方的日记</span></div>
      <div className="res-identity"><label htmlFor="res-identity">测试身份</label><select id="res-identity" value={actor} onChange={(event) => { setActor(event.target.value as Member); setNotice(""); }}><option value="self">我 · 绿色</option><option value="other">对方 · 陶粉色</option></select><p>切换身份，体验双方书写与回复。每人只能编辑、删除自己写的日记。</p></div>
    </aside>
    <section className="res-diary-main relative isolate" style={{ backgroundImage: `linear-gradient(180deg, rgba(23,47,42,.38), rgba(23,47,42,.18)), ${backgroundImage(background) ?? 'url("/bird3.jpg")'}` }}>
      {background.video && <div className="pointer-events-none absolute inset-0 -z-10"><BackgroundVideo media={background} /><div className="absolute inset-0 bg-emerald-950/30" /></div>}
      <header className="res-diary-header"><div className="res-diary-heading"><button className="res-icon res-add-entry" type="button" aria-label="写日记" title="写日记" onClick={() => setEditor({})}><Plus size={22} /></button><div><p className="res-eyebrow">RESONANCE / 共鸣</p><h1>{selectedDate.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</h1><span className="res-header-sub">以「{memberName(actor)}」的身份，写下今天。</span></div></div><div className="res-header-buttons"><button className="res-icon" type="button" aria-label="前一天" onClick={() => changeDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 1))}><ChevronLeft size={19} /></button><button className="res-icon" type="button" aria-label="后一天" onClick={() => changeDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1))}><ChevronRight size={19} /></button><SettingsButton type="button" aria-label="双人日记设置" title="头像与背景设置" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)} /></div></header>
      <div className="res-timeline">
        {error && <p className="res-error res-error-panel" role="alert">{error}</p>}
        {notice && <p className="res-timeline-notice" role="status">{notice}</p>}
        {posts.map((post) => <article className={`res-post res-${post.author}`} key={post.id}>
          <div className="res-post-head"><span className="res-author"><Avatar member={post.author} src={relationship.avatars?.[post.author]} /><span><strong>{memberName(post.author)}</strong><time dateTime={post.createdAt}>{timeLabel(post.createdAt)}{post.updatedAt ? " · 已编辑" : ""}</time></span></span>{post.author === actor && <div className="res-post-tools"><button className="res-icon" aria-label="编辑我的日记" title="编辑日记" type="button" onClick={() => setEditor({ post })}><Pencil size={16} /></button><button className="res-icon" aria-label="删除我的日记" title="删除日记" type="button" onClick={() => setDeleting({ postId: post.id })}><Trash2 size={16} /></button></div>}</div>
          {post.text && <p className="res-post-text">{post.text}</p>}
          {post.images.length > 0 && <div className="res-photos">{post.images.map((id) => <Photo key={id} id={id} onOpen={setPreview} />)}</div>}
          <div className="res-replies">{post.replies.map((reply) => <div className={`res-reply res-${reply.author}`} key={reply.id}><div className="res-reply-head"><strong><i className="res-dot" />{memberName(reply.author)}</strong><time dateTime={reply.createdAt}>{timeLabel(reply.createdAt)}</time>{reply.author === actor && <button className="res-icon" type="button" aria-label="删除我的回复" onClick={() => setDeleting({ postId: post.id, replyId: reply.id })}><Trash2 size={13} /></button>}</div><p>{reply.text}</p></div>)}<ReplyForm key={`${post.id}:${actor}`} relationshipId={relationship.id} postId={post.id} actor={actor} commit={commit} /></div>
        </article>)}
      </div>
    </section>
    <CompanionBalls relationship={relationship} commit={commit} error={error} />
    {settingsOpen && <Modal title="日记设置" onClose={() => setSettingsOpen(false)}>
      <div className="res-tabs" role="group" aria-label="设置分类"><button type="button" aria-pressed={settingsTab === "avatars"} onClick={() => setSettingsTab("avatars")}>头像设置</button><button type="button" aria-pressed={settingsTab === "background"} onClick={() => setSettingsTab("background")}>背景设置</button></div>
      {settingsTab === "background" ? <DiaryBackgroundSettings settings={backgroundSettings} /> : <>
      <p className="res-hint">更换后会同步显示在关系卡片和日记中。测试版可设置双方头像。</p>
      {(["self", "other"] as const).map((member) => <AvatarUpload key={member} member={member} value={relationship.avatars?.[member]} onChange={(value) => {
        commit((next) => { const current = findRelationship(next, relationship.id); const avatars = { ...current.avatars }; if (value) avatars[member] = value; else delete avatars[member]; current.avatars = avatars; });
      }} />)}
      {error && <p className="res-error" role="alert">{error}</p>}
      </>}
    </Modal>}
    {editor && <Editor relationship={relationship} actor={actor} date={selected} post={editor.post} commit={commit} error={error} onClose={() => { setEditor(null); setNotice("日记与草稿保存在当前浏览器"); }} onPreview={setPreview} />}
    {deleting && <Modal title={deleting.replyId ? "删除这条回复？" : "删除这条日记？"} onClose={() => setDeleting(null)}><p className="res-muted">{deleting.replyId ? "这条回复将被永久删除。" : "这条日记及其配图和回复将被永久删除，无法恢复。"}</p>{error && <p className="res-error" role="alert">{error}</p>}<div className="res-actions"><button className="res-secondary" type="button" onClick={() => setDeleting(null)}>取消</button><button className="res-danger" type="button" onClick={() => void remove()}>确认删除</button></div></Modal>}
    {preview && <Modal title="日记配图" wide onClose={() => setPreview(null)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="res-preview" src={preview} alt="放大的双人日记配图" />
    </Modal>}
  </main>;
}

export default function Resonance({ relationshipId, bucket = false, anniversaries = false }: { relationshipId?: string; bucket?: boolean; anniversaries?: boolean }) {
  const { store, error, commit } = useResonanceStore();
  if (!store) return <main className="res-loading"><Orbit size={30} /><p role={error ? "alert" : "status"}>{error || "正在打开共鸣…"}</p><Link href="/">返回主页</Link></main>;
  if (!relationshipId) return <RelationshipList store={store} commit={commit} error={error} />;
  const relationship = store.relationships.find((item) => item.id === relationshipId);
  if (!relationship) return <main className="res-loading"><Orbit size={30} /><h1>这份共鸣暂时不在这里</h1><p>卡片可能已删除，或保存在另一个浏览器中。</p><Link href="/resonance">返回共鸣卡片</Link></main>;
  return anniversaries ? <Anniversaries relationship={relationship} commit={commit} error={error} /> : bucket ? <BucketList relationship={relationship} commit={commit} error={error} /> : <SharedDiary key={relationship.id} relationship={relationship} commit={commit} error={error} />;
}
