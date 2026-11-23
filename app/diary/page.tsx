"use client";

import SettingsButton from "../_ui/settings-button";

import { BackgroundVideo, FollowHomeButton, backgroundAccept, backgroundFormatHint, backgroundImage, createBackgroundMedia, isBackgroundFile, useHomeBackground, type BackgroundMedia } from "../_background/media";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, ImagePlus, Plus, Trash2, X } from "lucide-react";
import "./diary.css";

type Post = { id: string; text: string; images: string[]; createdAt: string };
type Entry = { mood: string; cover?: string; posts: Post[] };
type Entries = Record<string, Entry>;
type LoadedImage = { id: string; url: string };
type Draft = { text: string; images: string[] };

const storageKey = "lyrebird-diary-entries";
const draftKey = "lyrebird-diary-draft:";
const coverPrefix = "diary-cover:";
const presetCovers = [
  { id: "bird3", name: "飞鸟 3", url: "/bird3.jpg" },
  { id: "bird1", name: "飞鸟 1", url: "/Bird1.jpg" },
  { id: "bird2", name: "飞鸟 2", url: "/bird2.jpg" },
  { id: "miku", name: "初音未来", url: "/初音未来.jpg" },
  { id: "frieren", name: "芙莉莲", url: "/芙莉莲.jpg" },
];
const moods = ["开心", "平静", "想念", "疲惫"];
const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
const emptyEntry = (): Entry => ({ mood: "", posts: [] });
const draftStorageKey = (date: string, id: string | null) => `${draftKey}${date}${id ? `:${id}` : ""}`;

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function fullDate(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 星期${weekdays[date.getDay()]}`;
}

function postTime(value: string) {
  if (!value) return "旧记录";
  const date = new Date(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function openDiaryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("lyrebird", 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("backgrounds")) request.result.createObjectStore("backgrounds");
      if (!request.result.objectStoreNames.contains("diary-images")) request.result.createObjectStore("diary-images");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getImage(id: string): Promise<Blob | undefined> {
  const db = await openDiaryDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("diary-images", "readonly").objectStore("diary-images").get(id);
      request.onsuccess = () => resolve(request.result as Blob | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function putImages(files: File[], prefix = "") {
  const db = await openDiaryDb();
  const ids = files.map(() => `${prefix}${crypto.randomUUID()}`);
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("diary-images", "readwrite");
      files.forEach((file, index) => transaction.objectStore("diary-images").put(file, ids[index]));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    return ids;
  } finally { db.close(); }
}

async function getSavedCovers(entries: Entries): Promise<{ id: string; blob: Blob }[]> {
  const db = await openDiaryDb();
  const referenced = new Set(Object.values(entries).map((entry) => entry.cover).filter((id): id is string => Boolean(id)));
  try {
    return await new Promise((resolve, reject) => {
      const covers: { id: string; blob: Blob }[] = [];
      const request = db.transaction("diary-images", "readonly").objectStore("diary-images").openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) { resolve(covers); return; }
        const id = String(cursor.key);
        if ((id.startsWith(coverPrefix) || referenced.has(id)) && cursor.value instanceof Blob) {
          covers.push({ id, blob: cursor.value });
        }
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function deleteImage(id: string) {
  const db = await openDiaryDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("diary-images", "readwrite");
      transaction.objectStore("diary-images").delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

function normalizeEntries(value: unknown): Entries {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries: Entries = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !raw || typeof raw !== "object") continue;
    const record = raw as Partial<Entry> & { text?: string; images?: string[] };
    const posts = Array.isArray(record.posts) ? record.posts.filter((post): post is Post =>
      Boolean(post && typeof post.id === "string" && typeof post.text === "string" && Array.isArray(post.images) && typeof post.createdAt === "string")
    ) : [];
    if (typeof record.text === "string" && (record.text.trim() || record.images?.length)) {
      posts.unshift({ id: `legacy-${key}`, text: record.text, images: Array.isArray(record.images) ? record.images : [], createdAt: "" });
    }
    entries[key] = { mood: typeof record.mood === "string" ? record.mood : "", cover: typeof record.cover === "string" && record.cover !== "see-you" ? record.cover : undefined, posts };
  }
  return entries;
}

export default function DiaryPage() {
  const [selected, setSelected] = useState("");
  const [viewYear, setViewYear] = useState(0);
  const [viewMonth, setViewMonth] = useState(0);
  const [entries, setEntries] = useState<Entries>({});
  const [savedCovers, setSavedCovers] = useState<(LoadedImage & BackgroundMedia)[]>([]);
  const homeBackground = useHomeBackground();
  const [coverRevision, setCoverRevision] = useState(0);
  const [photos, setPhotos] = useState<LoadedImage[]>([]);
  const [coverSettingsOpen, setCoverSettingsOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ text: "", images: [] });
  const [preview, setPreview] = useState<string | null>(null);
  const [saveState, setSaveState] = useState("已自动保存");
  const [imageError, setImageError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const entriesRef = useRef<Entries>({});
  const selectedRef = useRef("");
  const draftRef = useRef<Draft>({ text: "", images: [] });
  const editingIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let restored: Entries = {};
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Entries;
      restored = normalizeEntries(raw);
      if (Object.values(raw).some((entry) => entry?.cover === "see-you")) localStorage.setItem(storageKey, JSON.stringify(restored));
    } catch { /* Empty diary remains usable. */ }
    const today = new Date();
    const key = dateKey(today);
    entriesRef.current = restored;
    selectedRef.current = key;
    queueMicrotask(() => {
      setEntries(restored);
      setSelected(key);
      setViewYear(today.getFullYear());
      setViewMonth(today.getMonth());
    });
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const updateEntry = (key: string, patch: Partial<Entry>) => {
    const next = { ...entriesRef.current, [key]: { ...(entriesRef.current[key] ?? emptyEntry()), ...patch } };
    localStorage.setItem(storageKey, JSON.stringify(next));
    entriesRef.current = next;
    setEntries(next);
  };

  const saveDraft = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (!selectedRef.current || (!editorOpen && !timerRef.current)) return;
    localStorage.setItem(draftStorageKey(selectedRef.current, editingIdRef.current), JSON.stringify(draftRef.current));
    setSaveState("已自动保存");
  };

  const changeDate = (date: Date) => {
    saveDraft();
    const key = dateKey(date);
    selectedRef.current = key;
    setSelected(key);
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
    setPhotos([]);
    setPreview(null);
    setImageError("");
  };

  const changeMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
  };

  const entry = entries[selected] ?? emptyEntry();
  const diaryReady = Boolean(selected);
  const imageIds = entry.posts.flatMap((post) => post.images).concat(editorOpen ? draft.images : []).join("|");

  useEffect(() => {
    if (!selected) return;
    let active = true;
    const urls: string[] = [];
    const ids = [...new Set(imageIds ? imageIds.split("|") : [])];
    Promise.all(ids.map(async (id) => {
      const blob = await getImage(id);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      urls.push(url);
      return { id, url };
    })).then((loaded) => {
      if (active) setPhotos(loaded.filter((item): item is LoadedImage => item !== null));
    }).catch(() => { if (active) setImageError("图片读取失败，请刷新重试。"); });
    return () => { active = false; urls.forEach(URL.revokeObjectURL); };
  }, [selected, imageIds]);

  useEffect(() => {
    if (!diaryReady) return;
    let active = true;
    const urls: string[] = [];
    getSavedCovers(entriesRef.current).then((covers) => {
      if (!active) return;
      const loaded = covers.map(({ id, blob }) => {
        const media = createBackgroundMedia(blob);
        urls.push(media.url);
        return { id, ...media };
      });
      setSavedCovers(loaded);
    }).catch(() => { if (active) setImageError("封面读取失败，请刷新重试。"); });
    return () => { active = false; urls.forEach(URL.revokeObjectURL); };
  }, [diaryReady, coverRevision]);

  useEffect(() => {
    if (!editorOpen) return;
    editorRef.current?.focus();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setEditorOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener("keydown", onKeyDown); };
  }, [editorOpen]);

  useEffect(() => {
    if (!coverSettingsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setCoverSettingsOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [coverSettingsOpen]);

  const openEditor = (post?: Post) => {
    saveDraft();
    let next: Draft = { text: post?.text ?? "", images: post?.images ?? [] };
    try {
      const saved = JSON.parse(localStorage.getItem(draftStorageKey(selectedRef.current, post?.id ?? null)) ?? "null") as Draft | null;
      if (saved && typeof saved.text === "string" && Array.isArray(saved.images)) next = saved;
    } catch { /* Start with the saved post or a fresh draft. */ }
    editingIdRef.current = post?.id ?? null;
    setEditingId(post?.id ?? null);
    draftRef.current = next;
    setDraft(next);
    setImageError("");
    setEditorOpen(true);
  };

  const updateDraft = (next: Draft) => {
    draftRef.current = next;
    setDraft(next);
    setSaveState("保存中...");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(saveDraft, 500);
  };

  const addPhotos = async (files: File[]) => {
    const valid = files.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (!valid.length) { setImageError("请选择 JPG、PNG 或 WebP 图片。"); return; }
    setBusy(true);
    setImageError("");
    try {
      const ids = await putImages(valid);
      updateDraft({ ...draftRef.current, images: [...draftRef.current.images, ...ids] });
    } catch { setImageError("图片保存失败，请检查浏览器存储空间。"); }
    finally { setBusy(false); }
  };

  const changeCover = async (file?: File) => {
    if (!file) return;
    if (!isBackgroundFile(file)) { setImageError(`请选择 ${backgroundFormatHint} 文件。`); return; }
    const key = selectedRef.current;
    setBusy(true);
    setImageError("");
    try {
      const [id] = await putImages([file], coverPrefix);
      updateEntry(key, { cover: id });
      setCoverRevision((value) => value + 1);
      setCoverSettingsOpen(false);
    } catch { setImageError("封面保存失败，请检查浏览器存储空间。"); }
    finally { setBusy(false); }
  };

  const removeCover = async (id: string) => {
    if (!window.confirm("删除这张已上传的背景照片？使用它的日期将恢复默认背景。")) return;
    setBusy(true);
    setImageError("");
    try {
      const next = Object.fromEntries(Object.entries(entriesRef.current).map(([date, record]) => [
        date, record.cover === id ? { ...record, cover: undefined } : record,
      ])) as Entries;
      const usedInPost = Object.values(next).some((record) => record.posts.some((post) => post.images.includes(id)));
      if (!usedInPost) await deleteImage(id);
      localStorage.setItem(storageKey, JSON.stringify(next));
      entriesRef.current = next;
      setEntries(next);
      setCoverRevision((value) => value + 1);
    } catch {
      setImageError("删除失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  };

  const savePost = () => {
    const value = draftRef.current;
    const text = value.text.trim();
    if (!text && !value.images.length) return;
    const key = selectedRef.current;
    const posts = entriesRef.current[key]?.posts ?? [];
    const removedImages = editingId
      ? (posts.find((post) => post.id === editingId)?.images ?? []).filter((id) => !value.images.includes(id))
      : [];
    const next = editingId
      ? posts.map((post) => post.id === editingId ? { ...post, text, images: value.images } : post)
      : [{ id: crypto.randomUUID(), text, images: value.images, createdAt: new Date().toISOString() }, ...posts];
    updateEntry(key, { posts: next });
    void Promise.all(removedImages.map(deleteImage)).catch(() => setImageError("图片清理失败，请刷新重试。"));
    localStorage.removeItem(draftStorageKey(key, editingId));
    setSaveState("已自动保存");
    setEditorOpen(false);
  };

  const removePost = async () => {
    const key = selectedRef.current;
    const post = entriesRef.current[key]?.posts.find((item) => item.id === editingId);
    if (!post) return;
    updateEntry(key, { posts: entriesRef.current[key].posts.filter((item) => item.id !== post.id) });
    localStorage.removeItem(draftStorageKey(key, editingId));
    setEditorOpen(false);
    try { await Promise.all(post.images.map(deleteImage)); }
    catch { setImageError("图片清理失败，请刷新重试。"); }
  };

  const removeDraftPhoto = async (id: string) => {
    updateDraft({ ...draftRef.current, images: draftRef.current.images.filter((item) => item !== id) });
    if (!editingId) await deleteImage(id);
  };

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (!selectedRef.current) return;
      const files = Array.from(event.clipboardData?.items ?? [])
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile()).filter((file): file is File => file !== null);
      if (files.length) { event.preventDefault(); if (!editorOpen) openEditor(); void addPhotos(files); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  if (!selected) return <main className="diary-page" />;

  const selectedDate = fromKey(selected);
  const todayKey = dateKey(new Date());
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const years = Array.from({ length: 21 }, (_, index) => viewYear - 10 + index);
  const photoUrl = (id: string) => photos.find((photo) => photo.id === id)?.url;
  const activeCover: BackgroundMedia | undefined = [...presetCovers, ...savedCovers].find((cover) => cover.id === entry.cover) ?? homeBackground;
  const coverShade = "linear-gradient(180deg, rgba(15, 34, 31, .35), rgba(16, 39, 34, .13) 42%, rgba(14, 33, 29, .35))";

  return (
    <main className="diary-page">
      <aside className="diary-sidebar">
        <div className="diary-side-top"><Link href="/" className="diary-back" aria-label="返回主页" title="返回主页"><ArrowLeft size={20} /></Link><span className="diary-brand">Solitude / 独白</span></div>
        <div className="diary-calendar-top">
          <div className="diary-date-selects">
            <select aria-label="年份" value={viewYear} onChange={(event) => changeMonth(Number(event.target.value), viewMonth)}>{years.map((year) => <option key={year} value={year}>{year}年</option>)}</select>
            <select aria-label="月份" value={viewMonth} onChange={(event) => changeMonth(viewYear, Number(event.target.value))}>{Array.from({ length: 12 }, (_, month) => <option key={month} value={month}>{month + 1}月</option>)}</select>
          </div>
          <button className="diary-today" type="button" onClick={() => changeDate(new Date())}>今天</button>
        </div>
        <div className="diary-calendar" aria-label={`${viewYear}年${viewMonth + 1}月日历`}>
          {weekdays.map((day) => <span className="diary-weekday" key={day}>{day}</span>)}
          {Array.from({ length: firstWeekday }, (_, index) => <span key={`blank-${index}`} />)}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const key = dateKey(new Date(viewYear, viewMonth, day));
            const record = entries[key];
            const hasContent = Boolean(record?.posts?.length || record?.cover || record?.mood);
            return <button key={key} type="button" className={`diary-day ${key === selected ? "selected" : ""} ${key === todayKey ? "today" : ""}`} aria-label={`${viewMonth + 1}月${day}日${hasContent ? "，有记录" : ""}`} aria-current={key === todayKey ? "date" : undefined} aria-pressed={key === selected} onClick={() => changeDate(fromKey(key))}>
              <span>{day}</span>{hasContent && <i aria-hidden="true" />}
            </button>;
          })}
        </div>
      </aside>

      <section className="diary-main relative isolate" style={{ backgroundImage: `${coverShade}, ${backgroundImage(activeCover) ?? 'url("/bird3.jpg")'}` }}>
        {activeCover?.video && <div className="pointer-events-none absolute inset-0 -z-10"><BackgroundVideo media={activeCover} /><div className="absolute inset-0" style={{ backgroundImage: coverShade }} /></div>}
        <header className="diary-header">
          <div className="diary-header-left"><button className="diary-plus" type="button" aria-label="添加日记内容" title="添加日记内容" onClick={() => openEditor()}><Plus size={22} /></button><div><span className="diary-kicker">SOLITUDE / 独白</span><h1>{fullDate(selectedDate)}</h1></div></div>
          <div className="diary-header-actions">
            <div className="diary-nav"><button type="button" aria-label="前一天" title="前一天" onClick={() => changeDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 1))}><ChevronLeft size={20} /></button><button type="button" aria-label="后一天" title="后一天" onClick={() => changeDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1))}><ChevronRight size={20} /></button></div>
            <select className="diary-mood" aria-label="当日心情" value={entry.mood} onChange={(event) => updateEntry(selected, { mood: event.target.value })}><option value="">心情</option>{moods.map((mood) => <option key={mood} value={mood}>{mood}</option>)}</select>
            <span className="diary-save-status"><Check size={14} />{saveState}</span>
            <SettingsButton type="button" aria-label="背景设置" title="背景设置" onClick={() => setCoverSettingsOpen(true)} />
          </div>
        </header>

        <div className="diary-content">
          {imageError && !editorOpen && <p className="diary-error" role="alert">{imageError}</p>}
          <div className="diary-posts">
            {entry.posts.map((post) => <article className="diary-post" key={post.id}>
              <button className="diary-post-edit" type="button" aria-label="编辑这条日记" title="编辑这条日记" onClick={() => openEditor(post)}>编辑</button>
              {post.text && <p>{post.text}</p>}
              {post.images.length > 0 && <div className="diary-post-photos">{post.images.map((id) => photoUrl(id) && <button type="button" key={id} className="diary-photo" aria-label="放大配图" onClick={() => setPreview(photoUrl(id) ?? null)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl(id)} alt="日记配图" />
              </button>)}</div>}
              <time dateTime={post.createdAt || undefined}>{post.createdAt ? `记录于 ${postTime(post.createdAt)}` : "旧记录"}</time>
            </article>)}
          </div>
        </div>
      </section>

      {coverSettingsOpen && <div className="diary-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCoverSettingsOpen(false); }}>
        <section className="diary-cover-dialog" role="dialog" aria-modal="true" aria-labelledby="diary-cover-title">
          <div className="diary-editor-head"><h2 id="diary-cover-title">当日背景</h2><button type="button" aria-label="关闭背景设置" title="关闭" onClick={() => setCoverSettingsOpen(false)}><X size={20} /></button></div>
          <label className="diary-cover-upload" htmlFor="diary-cover-input"><ImagePlus size={17} />上传背景</label>
          <input id="diary-cover-input" className="visually-hidden" type="file" accept={backgroundAccept} disabled={busy} onChange={(event) => { void changeCover(event.target.files?.[0]); event.target.value = ""; }} />
          {imageError && <p className="diary-error" role="alert">{imageError}</p>}
          <FollowHomeButton active={!entry.cover} onSelect={() => { updateEntry(selected, { cover: undefined }); setCoverSettingsOpen(false); }} />
          <div className="diary-cover-gallery" role="group" aria-label="选择当日背景">
            {presetCovers.map((cover) => <button type="button" key={cover.id} className={`diary-cover-choice ${entry.cover === cover.id ? "selected" : ""}`} aria-label={`使用${cover.name}背景`} aria-pressed={entry.cover === cover.id} onClick={() => { updateEntry(selected, { cover: cover.id }); setCoverSettingsOpen(false); }}>
              <span className="diary-cover-thumb" style={{ backgroundImage: `url("${cover.url}")` }}>{entry.cover === cover.id && <Check size={17} />}</span><span>{cover.name}</span>
            </button>)}
            {savedCovers.map((cover, index) => <div className="diary-cover-saved" key={cover.id}>
              <button type="button" className={`diary-cover-choice ${entry.cover === cover.id ? "selected" : ""}`} aria-label={`使用已上传背景 ${index + 1}`} aria-pressed={entry.cover === cover.id} onClick={() => { updateEntry(selected, { cover: cover.id }); setCoverSettingsOpen(false); }}>
                <span className="diary-cover-thumb relative" style={{ backgroundImage: backgroundImage(cover) }}><BackgroundVideo media={cover} preview />{entry.cover === cover.id && <Check className="relative" size={17} />}</span><span>已上传 {index + 1}</span>
              </button>
              <button className="diary-cover-delete" type="button" aria-label={`删除已上传背景 ${index + 1}`} title="删除已上传的背景" disabled={busy} onClick={() => void removeCover(cover.id)}><Trash2 size={15} /></button>
            </div>)}
          </div>
        </section>
      </div>}

      {editorOpen && <div className="diary-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) { saveDraft(); setEditorOpen(false); } }}>
        <section className="diary-editor" role="dialog" aria-modal="true" aria-labelledby="diary-editor-title">
          <div className="diary-editor-head"><h2 id="diary-editor-title">{editingId ? "编辑日记" : "添加日记"}</h2><button type="button" aria-label="关闭编辑" title="关闭编辑" onClick={() => { saveDraft(); setEditorOpen(false); }}><X size={20} /></button></div>
          <textarea ref={editorRef} aria-label="日记文字" placeholder="写下此刻..." value={draft.text} onChange={(event) => updateDraft({ ...draftRef.current, text: event.target.value })} onBlur={saveDraft} />
          <div className={`diary-dropzone ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); void addPhotos(Array.from(event.dataTransfer.files)); }}>
            <label className="diary-add-photo" htmlFor="diary-photo-input"><ImagePlus size={18} />添加图片</label><input id="diary-photo-input" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={(event) => { void addPhotos(Array.from(event.target.files ?? [])); event.target.value = ""; }} /><span>拖入或粘贴图片</span>
          </div>
          {draft.images.length > 0 && <div className="diary-draft-photos">{draft.images.map((id) => photoUrl(id) && <div className="diary-draft-photo" key={id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl(id)} alt="待保存配图" /><button type="button" aria-label="移除配图" title="移除配图" onClick={() => void removeDraftPhoto(id)}><Trash2 size={16} /></button>
          </div>)}</div>}
          {imageError && <p className="diary-error" role="alert">{imageError}</p>}
          <div className="diary-editor-actions">{editingId && <button className="diary-delete-post" type="button" onClick={() => void removePost()}><Trash2 size={17} />删除</button>}<span>{saveState}</span><button className="diary-save-post" type="button" disabled={!draft.text.trim() && !draft.images.length} onClick={savePost}>保存记录</button></div>
        </section>
      </div>}

      {preview && <div className="diary-preview" role="dialog" aria-modal="true" aria-label="图片预览" onClick={() => setPreview(null)}>
        <button type="button" aria-label="关闭预览" title="关闭预览"><X size={24} /></button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="放大的日记配图" onClick={(event) => event.stopPropagation()} />
      </div>}
    </main>
  );
}
