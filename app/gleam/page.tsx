"use client";

import { BackgroundVideo, FollowHomeButton, backgroundAccept, backgroundFormatHint, backgroundImage, createBackgroundMedia, followHome, isBackgroundFile, openBackgroundDb, useHomeBackground, writeBackgroundUpload, type BackgroundMedia } from "../_background/media";


import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, ImagePlus, Plus, Settings, Trash2, X } from "lucide-react";
import "./gleam.css";

type Gleam = { id: string; text: string; createdAt: string; page?: number; position?: { x: number; y: number } };
type GleamSettings = { transparency: number; speed: number; amplitude: number };
type SavedBackground = { id: string; name: string } & BackgroundMedia;

const notesKey = "lyrebird-gleam-notes";
const pagesKey = "lyrebird-gleam-pages";
const settingsKey = "lyrebird-gleam-settings";
const backgroundKey = "gleam-custom";
const backgroundPrefix = "gleam-photo:";
const selectedBackgroundKey = "lyrebird-gleam-background";
const presetBackgrounds = [
  { id: "bird3", name: "飞鸟 3", url: "/bird3.jpg" },
  { id: "bird1", name: "飞鸟 1", url: "/Bird1.jpg" },
  { id: "bird2", name: "飞鸟 2", url: "/bird2.jpg" },
  { id: "miku", name: "初音未来", url: "/初音未来.jpg" },
  { id: "frieren", name: "芙莉莲", url: "/芙莉莲.jpg" },
];
const defaultSettings: GleamSettings = { transparency: 50, speed: 1, amplitude: 6 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function savedSetting(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

async function getBackgrounds(): Promise<{ id: string; blob: Blob }[]> {
  const db = await openBackgroundDb();
  try {
    return await new Promise((resolve, reject) => {
      const backgrounds: { id: string; blob: Blob }[] = [];
      const request = db.transaction("backgrounds", "readonly").objectStore("backgrounds").openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(backgrounds);
          return;
        }
        if (typeof cursor.key === "string" &&
          (cursor.key === backgroundKey || cursor.key.startsWith(backgroundPrefix)) &&
          cursor.value instanceof Blob) {
          backgrounds.push({ id: cursor.key, blob: cursor.value });
        }
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}


function formatDate(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function GleamPage() {
  const [notes, setNotes] = useState<Gleam[]>([]);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagesReady, setPagesReady] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gleamSettings, setGleamSettings] = useState<GleamSettings>(defaultSettings);
  const [backgrounds, setBackgrounds] = useState<SavedBackground[]>([]);
  const [selectedBackground, setSelectedBackground] = useState(followHome);
  const homeBackground = useHomeBackground();
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fieldSize, setFieldSize] = useState({ width: 0, viewportHeight: 0 });
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});
  const backgroundUrlsRef = useRef<string[]>([]);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; pointerId: number; startX: number; startY: number; left: number; top: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef<{ id: string; until: number } | null>(null);

  useEffect(() => {
    let active = true;
    let restoredNotes: Gleam[] = [];
    try {
      const stored = JSON.parse(localStorage.getItem(notesKey) ?? "[]") as unknown;
      if (Array.isArray(stored)) {
        restoredNotes = stored.filter((item): item is Gleam =>
          typeof item === "object" && item !== null &&
          typeof item.id === "string" && typeof item.text === "string" && typeof item.createdAt === "string"
        ).map((note) => ({
          ...note,
          page: Number.isSafeInteger(note.page) && (note.page ?? 0) > 0 ? note.page : 1,
          position: note.position && Number.isFinite(note.position.x) && Number.isFinite(note.position.y)
            ? { x: clamp(note.position.x, 0, 1), y: clamp(note.position.y, 0, 1) }
            : undefined,
        }));
      }
    } catch {
      // Keep the page usable if local storage contains invalid data.
    }
    const storedPageCount = Number(localStorage.getItem(pagesKey));
    const count = Math.max(
      1,
      Number.isSafeInteger(storedPageCount) && storedPageCount > 0 ? storedPageCount : 1,
      ...restoredNotes.map((note) => note.page ?? 1),
    );
    queueMicrotask(() => {
      if (!active) return;
      setNotes(restoredNotes);
      setPageCount(count);
      setCurrentPage(count);
      setPagesReady(true);
    });
    try {
      const stored = JSON.parse(localStorage.getItem(settingsKey) ?? "null") as Partial<GleamSettings> | null;
      if (stored && typeof stored === "object") {
        const restored = {
          transparency: savedSetting(stored.transparency, 50, 0, 90),
          speed: savedSetting(stored.speed, 1, 0.5, 2),
          amplitude: savedSetting(stored.amplitude, 6, 0, 16),
        };
        queueMicrotask(() => { if (active) setGleamSettings(restored); });
      }
    } catch {
      // Invalid saved settings fall back to the defaults.
    }
    getBackgrounds().then((saved) => {
      if (!active) return;
      const gallery = saved
        .sort((a, b) => b.id.localeCompare(a.id))
        .map(({ id, blob }) => {
          const media = createBackgroundMedia(blob);
          backgroundUrlsRef.current.push(media.url);
          return { id, name: blob instanceof File ? blob.name : "已上传背景", ...media };
        });
      setBackgrounds(gallery);
      const selected = localStorage.getItem(selectedBackgroundKey);
      if (selected === "see-you") localStorage.removeItem(selectedBackgroundKey);
      if (selected && (selected === followHome || selected === "default" || presetBackgrounds.some((item) => item.id === selected) || gallery.some((item) => item.id === selected))) {
        setSelectedBackground(selected);
      } else if (!selected && gallery.some((item) => item.id === backgroundKey)) {
        setSelectedBackground(backgroundKey);
      }
    }).catch(() => {
      if (active) setUploadError("背景读取失败，请重新上传。");
    });
    return () => {
      active = false;
      backgroundUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      backgroundUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!editorOpen && !settingsOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (editorOpen) editorRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditorOpen(false);
        setSettingsOpen(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [editorOpen, settingsOpen]);

  const activeNote = notes.find((note) => note.id === activeId);
  const pageNotes = notes.filter((note) => (note.page ?? 1) === currentPage);

  useEffect(() => {
    if (!pageNotes.length || !fieldRef.current) return;
    const field = fieldRef.current;
    const measure = () => setFieldSize({ width: field.clientWidth, viewportHeight: window.innerHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(field);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [pageNotes.length]);

  useEffect(() => {
    if (!pageNotes.length || !fieldRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setCardHeights((current) => {
        let changed = false;
        const next = { ...current };
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.noteId;
          if (!id) continue;
          const height = Math.ceil(entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height);
          if (next[id] !== height) { next[id] = height; changed = true; }
        }
        return changed ? next : current;
      });
    });
    fieldRef.current.querySelectorAll<HTMLElement>(".gleam-note-position").forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [pageNotes.length, currentPage]);

  const columns = fieldSize.width < 520 ? 1 : fieldSize.width < 900 ? 2 : 3;
  const cardWidth = columns === 1
    ? Math.min(310, fieldSize.width)
    : Math.min(310, fieldSize.width / columns - 22);
  const rowHeights = Array.from({ length: Math.ceil(pageNotes.length / columns) }, (_, row) =>
    Math.max(...pageNotes.slice(row * columns, (row + 1) * columns).map((note) => cardHeights[note.id] ?? (columns === 1 ? 132 : 154)))
  );
  const rowTop = (row: number) => 110 + rowHeights.slice(0, row).reduce((total, height) => total + height + 55, 0);
  const fieldHeight = Math.max(fieldSize.viewportHeight, rowTop(rowHeights.length) + 90);

  const notePosition = (note: Gleam, index: number) => {
    const maxX = Math.max(0, fieldSize.width - cardWidth);
    const maxY = Math.max(0, fieldHeight - (cardHeights[note.id] ?? (columns === 1 ? 132 : 154)) - 16);
    if (note.position) {
      return { left: note.position.x * maxX, top: note.position.y * maxY };
    }
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      left: columns === 1
        ? (index % 2 === 0 ? 0 : maxX)
        : clamp((column + 0.5) * fieldSize.width / columns - cardWidth / 2, 0, maxX),
      top: clamp(rowTop(row) + (column % 2) * 45, 0, maxY),
    };
  };

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>, note: Gleam) => {
    if (event.button !== 0 || !fieldRef.current) return;
    const field = fieldRef.current.getBoundingClientRect();
    const card = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      id: note.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      left: card.left - field.left, top: card.top - field.top, moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !fieldRef.current) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    event.currentTarget.classList.add("dragging");
    const maxX = Math.max(0, fieldRef.current.clientWidth - event.currentTarget.offsetWidth);
    const maxY = Math.max(0, fieldRef.current.clientHeight - event.currentTarget.offsetHeight - 16);
    event.currentTarget.style.left = `${clamp(drag.left + dx, 0, maxX)}px`;
    event.currentTarget.style.top = `${clamp(drag.top + dy, 0, maxY)}px`;
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !fieldRef.current) return;
    if (drag.moved) {
      const maxX = Math.max(0, fieldRef.current.clientWidth - event.currentTarget.offsetWidth);
      const maxY = Math.max(0, fieldRef.current.clientHeight - event.currentTarget.offsetHeight - 16);
      const position = {
        x: maxX ? clamp(parseFloat(event.currentTarget.style.left) / maxX, 0, 1) : 0,
        y: maxY ? clamp(parseFloat(event.currentTarget.style.top) / maxY, 0, 1) : 0,
      };
      updateNotes(notes.map((note) => note.id === drag.id ? { ...note, position } : note));
      suppressClickRef.current = { id: drag.id, until: event.timeStamp + 300 };
    }
    event.currentTarget.classList.remove("dragging");
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };

  const cancelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    const note = pageNotes.find((item) => item.id === dragRef.current?.id);
    if (note) {
      const position = notePosition(note, pageNotes.indexOf(note));
      event.currentTarget.style.left = `${position.left}px`;
      event.currentTarget.style.top = `${position.top}px`;
    }
    event.currentTarget.classList.remove("dragging");
    dragRef.current = null;
  };

  const openEditor = (note?: Gleam) => {
    setActiveId(note?.id ?? null);
    setDraft(note?.text ?? "");
    setConfirmDelete(false);
    setEditorOpen(true);
  };

  const updateNotes = (next: Gleam[]) => {
    localStorage.setItem(notesKey, JSON.stringify(next));
    setNotes(next);
  };

  const addPage = () => {
    const nextPage = pageCount + 1;
    localStorage.setItem(pagesKey, String(nextPage));
    setPageCount(nextPage);
    setCurrentPage(nextPage);
    openEditor();
  };

  const updateSetting = (key: keyof GleamSettings, value: number) => {
    const next = { ...gleamSettings, [key]: value };
    setGleamSettings(next);
    localStorage.setItem(settingsKey, JSON.stringify(next));
  };

  const chooseBackground = (id: string) => {
    setSelectedBackground(id);
    localStorage.setItem(selectedBackgroundKey, id);
  };

  const save = () => {
    const text = draft.trim();
    if (!text) return;
    const next = activeNote
      ? notes.map((note) => note.id === activeNote.id ? { ...note, text } : note)
      : [{ id: crypto.randomUUID(), text, createdAt: new Date().toISOString(), page: currentPage }, ...notes];
    updateNotes(next);
    setEditorOpen(false);
  };

  const remove = () => {
    if (!activeNote) return;
    updateNotes(notes.filter((note) => note.id !== activeNote.id));
    setEditorOpen(false);
    setConfirmDelete(false);
  };

  const upload = async (file?: File) => {
    if (!file) return;
    if (!isBackgroundFile(file)) {
      setUploadError(`请选择 ${backgroundFormatHint} 文件。`);
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const id = `${backgroundPrefix}${Date.now()}-${crypto.randomUUID()}`;
      await writeBackgroundUpload(id, file);
      const media = createBackgroundMedia(file);
      backgroundUrlsRef.current.push(media.url);
      setBackgrounds((current) => [{ id, name: file.name, ...media }, ...current]);
      chooseBackground(id);
      setSettingsOpen(false);
    } catch {
      setUploadError("照片保存失败，请检查浏览器存储空间后重试。");
    } finally {
      setUploading(false);
    }
  };

  const removeBackground = async (item: SavedBackground) => {
    if (!window.confirm("删除这张已上传的背景照片？")) return;
    setUploading(true);
    setUploadError("");
    try {
      await writeBackgroundUpload(item.id);
      if (selectedBackground === item.id) chooseBackground(followHome);
      setBackgrounds((current) => current.filter((background) => background.id !== item.id));
      backgroundUrlsRef.current = backgroundUrlsRef.current.filter((url) => url !== item.url);
      URL.revokeObjectURL(item.url);
    } catch {
      setUploadError("删除失败，请稍后重试。");
    } finally {
      setUploading(false);
    }
  };

  const activeBackground = selectedBackground === followHome ? homeBackground : [...presetBackgrounds, ...backgrounds].find((item) => item.id === selectedBackground);

  return (
    <main className="gleam-page">
      <div className="gleam-background" style={{ backgroundImage: backgroundImage(activeBackground) }}><BackgroundVideo media={activeBackground} /></div>
      <div className="gleam-tint" />

      <nav className="gleam-toolbar" aria-label="浮光操作">
        <Link className="gleam-tool" href="/" aria-label="返回主页" title="返回主页"><ArrowLeft size={21} strokeWidth={1.7} /></Link>
        <div className="gleam-toolbar-right">
          <button className="gleam-tool" type="button" aria-label="背景设置" title="背景设置" onClick={() => setSettingsOpen(true)}><Settings size={21} strokeWidth={1.7} /></button>
          <button className="gleam-tool gleam-add" type="button" aria-label="添加浮光" title="添加浮光" onClick={() => openEditor()}><Plus size={23} strokeWidth={1.7} /></button>
        </div>
      </nav>

      {pageNotes.length > 0 && (
        <div ref={fieldRef} className="gleam-field" aria-label="浮光记录" style={{ height: fieldHeight, "--gleam-opacity": 1 - gleamSettings.transparency / 100, "--gleam-drift": `${gleamSettings.amplitude}px` } as CSSProperties}>
          {pageNotes.map((note, index) => (
            <div
              className="gleam-note-position" key={note.id}
              data-note-id={note.id}
              style={{ ...notePosition(note, index), width: cardWidth }}
              onPointerDown={(event) => startDrag(event, note)}
              onPointerMove={moveDrag}
              onPointerUp={finishDrag}
              onPointerCancel={cancelDrag}
              onClick={(event) => {
                if (suppressClickRef.current?.id === note.id && event.timeStamp < suppressClickRef.current.until) {
                  suppressClickRef.current = null;
                  return;
                }
                openEditor(note);
              }}
            >
              <button className="gleam-note" type="button" style={{ animationDelay: `${-(index % 7) * 1.1}s`, animationDuration: `${(7 + index % 5) / gleamSettings.speed}s` }}>
                <span className="gleam-note-text">{note.text}</span>
                <time className="gleam-note-time" dateTime={note.createdAt}>{formatDate(note.createdAt)}</time>
              </button>
            </div>
          ))}
        </div>
      )}

      {pagesReady && (
        <nav className="gleam-pagination" aria-label="浮光翻页">
          <button type="button" aria-label="上一页" title="上一页" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}><ChevronLeft size={20} /></button>
          <span className="gleam-page-count" aria-live="polite">{currentPage}/{pageCount}</span>
          <button type="button" aria-label="下一页" title="下一页" disabled={currentPage === pageCount} onClick={() => setCurrentPage(currentPage + 1)}><ChevronRight size={20} /></button>
          <span className="gleam-page-divider" aria-hidden="true" />
          <button type="button" aria-label="添加新页面" title="添加新页面" onClick={addPage}><Plus size={21} /></button>
        </nav>
      )}

      {settingsOpen && (
        <div className="gleam-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <section className="gleam-dialog gleam-settings" role="dialog" aria-modal="true" aria-labelledby="gleam-settings-title">
            <div className="gleam-dialog-head">
              <h2 id="gleam-settings-title">浮光设置</h2>
              <button className="gleam-close" type="button" aria-label="关闭设置" title="关闭设置" onClick={() => setSettingsOpen(false)}><X size={19} /></button>
            </div>
            <label className="gleam-upload" htmlFor="gleam-background-upload"><ImagePlus size={19} />{uploading ? "正在保存..." : "上传背景"}</label>
            <input id="gleam-background-upload" className="visually-hidden" type="file" accept={backgroundAccept} disabled={uploading} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} />
            <p className="gleam-file-hint">{backgroundFormatHint}</p>
            {uploadError && <p className="gleam-error" role="alert">{uploadError}</p>}
            <FollowHomeButton active={selectedBackground === followHome} onSelect={() => chooseBackground(followHome)} />
            <div className="gleam-background-gallery" role="group" aria-label="已保存背景">
              {presetBackgrounds.map((item) => (
                <button className={`gleam-background-choice ${selectedBackground === item.id || (item.id === "bird3" && selectedBackground === "default") ? "selected" : ""}`} type="button" key={item.id} aria-pressed={selectedBackground === item.id || (item.id === "bird3" && selectedBackground === "default")} onClick={() => chooseBackground(item.id)}>
                  <span className="gleam-background-thumb" style={{ backgroundImage: `url("${item.url}")` }}>{(selectedBackground === item.id || (item.id === "bird3" && selectedBackground === "default")) && <Check size={18} />}</span>
                  <span>{item.name}</span>
                </button>
              ))}
              {backgrounds.map((item) => (
                <div className="gleam-background-saved" key={item.id}>
                  <button className={`gleam-background-choice ${selectedBackground === item.id ? "selected" : ""}`} type="button" aria-pressed={selectedBackground === item.id} onClick={() => chooseBackground(item.id)}>
                    <span className="gleam-background-thumb relative" style={{ backgroundImage: backgroundImage(item) }}><BackgroundVideo media={item} preview />{selectedBackground === item.id && <Check className="relative" size={18} />}</span>
                    <span title={item.name}>{item.name}</span>
                  </button>
                  <button className="gleam-background-delete" type="button" aria-label={`删除已上传背景 ${item.name}`} title="删除已上传的背景" disabled={uploading} onClick={() => void removeBackground(item)}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            <div className="gleam-controls">
              <label htmlFor="gleam-transparency"><span>漂浮框透明度</span><output>{gleamSettings.transparency}%</output></label>
              <input id="gleam-transparency" type="range" min="0" max="90" step="5" value={gleamSettings.transparency} onChange={(event) => updateSetting("transparency", Number(event.target.value))} />
              <label htmlFor="gleam-speed"><span>浮动速度</span><output>{gleamSettings.speed.toFixed(1)} 倍</output></label>
              <input id="gleam-speed" type="range" min="0.5" max="2" step="0.1" value={gleamSettings.speed} onChange={(event) => updateSetting("speed", Number(event.target.value))} />
              <label htmlFor="gleam-amplitude"><span>浮动幅度</span><output>{gleamSettings.amplitude}px</output></label>
              <input id="gleam-amplitude" type="range" min="0" max="16" step="1" value={gleamSettings.amplitude} onChange={(event) => updateSetting("amplitude", Number(event.target.value))} />
            </div>
          </section>
        </div>
      )}

      {editorOpen && (
        <div className="gleam-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditorOpen(false); }}>
          <section className="gleam-dialog gleam-editor" role="dialog" aria-modal="true" aria-labelledby="gleam-editor-title">
            <div className="gleam-dialog-head">
              <h2 id="gleam-editor-title">{activeNote ? "编辑浮光" : "添加浮光"}</h2>
              <button className="gleam-close" type="button" aria-label="关闭编辑" title="关闭编辑" onClick={() => setEditorOpen(false)}><X size={19} /></button>
            </div>
            <textarea ref={editorRef} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="写下一段此刻的心绪..." aria-label="浮光文字" rows={7} maxLength={2000} />
            {activeNote && <time className="gleam-editor-time" dateTime={activeNote.createdAt}>{formatDate(activeNote.createdAt)}</time>}
            <div className="gleam-editor-actions">
              {activeNote && (confirmDelete ? <button className="gleam-delete-confirm" type="button" onClick={remove}>确认删除</button> : <button className="gleam-delete" type="button" onClick={() => setConfirmDelete(true)} aria-label="删除浮光" title="删除浮光"><Trash2 size={19} /></button>)}
              <button className="gleam-save" type="button" disabled={!draft.trim()} onClick={save}><Check size={18} />保存</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
