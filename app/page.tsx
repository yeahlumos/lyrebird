"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BookOpenText,
  Check,
  FolderOpen,
  HeartHandshake,
  ImagePlus,
  NotebookPen,
  Orbit,
  Radar,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

const preferenceKey = "lyrebird-background";
const customKey = "custom";

const backgrounds = [
  { id: "bird3", name: "飞鸟 3", style: { backgroundImage: 'url("/bird3.jpg")' } },
  { id: "bird1", name: "飞鸟 1", style: { backgroundImage: 'url("/Bird1.jpg")' } },
  { id: "bird2", name: "飞鸟 2", style: { backgroundImage: 'url("/bird2.jpg")' } },
  { id: "miku", name: "初音未来", style: { backgroundImage: 'url("/初音未来.jpg")' } },
  { id: "frieren", name: "芙莉莲", style: { backgroundImage: 'url("/芙莉莲.jpg")' } },
  { id: "mist", name: "薄雾", style: { background: "linear-gradient(135deg, #658c86 0%, #a9c7bd 46%, #d3dbca 100%)" } },
  { id: "dusk", name: "暮色", style: { background: "linear-gradient(135deg, #24404b 0%, #747b85 52%, #ba9b97 100%)" } },
] as const;

const sections = [
  { number: "01", title: "Gleam / 浮光", description: "灵感记录空间", icon: Sparkles, className: "gleam" },
  { number: "02", title: "Solitude / 独白", description: "记录每一天", icon: NotebookPen, className: "diary" },
  { number: "03", title: "Dossier / 个人志", description: "履历与成长归档", icon: FolderOpen, className: "dossier" },
  { number: "04", title: "Atelier / 造物", description: "项目与学习", icon: BookOpenText, className: "atelier" },
  { number: "05", title: "Resonance / 共鸣", description: "即将开启", icon: Orbit, className: "resonance" },
  { number: "06", title: "Gravity / 引力场", description: "即将开启", icon: Radar, className: "gravity" },
  { number: "07", title: "Hollow / 树洞", description: "即将开启", icon: HeartHandshake, className: "hollow" },
] as const;

function openBackgroundDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("lyrebird");
    request.onupgradeneeded = () => {
      request.result.createObjectStore("backgrounds");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readCustomBackground(): Promise<Blob | undefined> {
  const db = await openBackgroundDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("backgrounds", "readonly").objectStore("backgrounds").get(customKey);
      request.onsuccess = () => resolve(request.result as Blob | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function saveCustomBackground(file: File): Promise<void> {
  const db = await openBackgroundDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("backgrounds", "readwrite");
      transaction.objectStore("backgrounds").put(file, customKey);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

async function deleteCustomBackground(): Promise<void> {
  const db = await openBackgroundDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("backgrounds", "readwrite");
      transaction.objectStore("backgrounds").delete(customKey);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export default function Home() {
  const [selected, setSelected] = useState("bird3");
  const [customUrl, setCustomUrl] = useState<string>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const customUrlRef = useRef<string | undefined>(undefined);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    const saved = localStorage.getItem(preferenceKey);
    if (saved === "see-you") localStorage.removeItem(preferenceKey);
    if (saved && backgrounds.some((background) => background.id === saved)) {
      queueMicrotask(() => {
        if (active) setSelected(saved);
      });
    }
    readCustomBackground()
      .then((blob) => {
        if (!active) return;
        if (!blob) {
          if (saved === customKey) localStorage.removeItem(preferenceKey);
          return;
        }
        const url = URL.createObjectURL(blob);
        customUrlRef.current = url;
        setCustomUrl(url);
        if (saved === customKey) setSelected(customKey);
      })
      .catch(() => {
        if (active && saved === customKey) setUploadError("无法读取已保存的照片，请重新上传。");
      });
    return () => {
      active = false;
      if (customUrlRef.current) URL.revokeObjectURL(customUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const oldOverflow = document.body.style.overflow;
    const settingsButton = settingsButtonRef.current;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = oldOverflow;
      settingsButton?.focus();
    };
  }, [settingsOpen]);

  const chooseBackground = (id: string) => {
    setSelected(id);
    localStorage.setItem(preferenceKey, id);
    setUploadError("");
  };

  const uploadBackground = async (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadError("请选择 JPG、PNG 或 WebP 图片。");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      await saveCustomBackground(file);
      const url = URL.createObjectURL(file);
      if (customUrlRef.current) URL.revokeObjectURL(customUrlRef.current);
      customUrlRef.current = url;
      setCustomUrl(url);
      chooseBackground(customKey);
    } catch {
      setUploadError("照片保存失败，请检查浏览器存储空间后重试。");
    } finally {
      setUploading(false);
    }
  };

  const removeCustomBackground = async () => {
    if (!window.confirm("删除这张已上传的背景照片？")) return;
    setUploading(true);
    setUploadError("");
    try {
      await deleteCustomBackground();
      if (selected === customKey) chooseBackground("bird3");
      if (customUrlRef.current) URL.revokeObjectURL(customUrlRef.current);
      customUrlRef.current = undefined;
      setCustomUrl(undefined);
    } catch {
      setUploadError("删除失败，请稍后重试。");
    } finally {
      setUploading(false);
    }
  };

  const selectedBackground = backgrounds.find((background) => background.id === selected);
  const heroStyle = selected === customKey && customUrl
    ? { backgroundImage: `url("${customUrl}")` }
    : selectedBackground?.style ?? backgrounds[0].style;

  return (
    <main>
      <section className="hero" aria-labelledby="site-title">
        <div className="hero-image" style={heroStyle} />
        <div className="hero-shade" />
        <div className="hero-topline">
          <span className="topline-mark">LYREBIRD <span>琴鸟</span></span>
          <button
            ref={settingsButtonRef}
            className="settings-trigger"
            type="button"
            aria-label="背景设置"
            title="背景设置"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={21} strokeWidth={1.7} />
          </button>
        </div>

        <div className="hero-content">
          <h1 id="site-title">Lyrebird</h1>
          <span className="hero-divider" aria-hidden="true" />
          <p>for you, a thousand times over</p>
        </div>

        <a className="scroll-cue" href="#spaces" aria-label="向下查看分区" title="查看分区">
          <ArrowDown size={25} strokeWidth={1.5} />
        </a>
      </section>

      <section className="spaces" id="spaces" aria-labelledby="spaces-title">
        <div className="spaces-inner">
          <header className="spaces-heading">
            <span className="section-index">LYREBIRD / SPACES</span>
            <h2 id="spaces-title">my mind grows</h2>
          </header>
          <div className="spaces-grid">
            {sections.map((section) => {
              const Icon = section.icon;
              const content = (
                <>
                  <div className="space-card-top">
                    <span>{section.number}</span>
                    <Icon size={28} strokeWidth={1.45} aria-hidden="true" />
                  </div>
                  <div className="space-card-bottom">
                    <div>
                      <h3>{section.title}</h3>
                      <p>{section.description}</p>
                    </div>
                    {["01", "02", "03", "04"].includes(section.number) ? <ArrowRight size={22} strokeWidth={1.7} aria-hidden="true" /> : <span className="coming-soon">敬请期待</span>}
                  </div>
                </>
              );
              return ["01", "02", "03", "04"].includes(section.number) ? (
                <Link className={`space-card ${section.className} space-card-link`} href={section.number === "01" ? "/gleam" : section.number === "02" ? "/diary" : section.number === "03" ? "/dossier" : "/atelier"} key={section.number}>
                  {content}
                </Link>
              ) : (
                <article className={`space-card ${section.className}`} key={section.number}>
                  {content}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {settingsOpen && (
        <div className="settings-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSettingsOpen(false);
        }}>
          <aside className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="settings-header">
              <div>
                <span className="settings-eyebrow">PERSONALIZE</span>
                <h2 id="settings-title">背景设置</h2>
              </div>
              <button ref={closeButtonRef} className="close-button" type="button" aria-label="关闭设置" title="关闭设置" onClick={() => setSettingsOpen(false)}>
                <X size={21} />
              </button>
            </div>
            <p className="settings-intro">选择你喜欢的首页画面</p>
            <div className="preset-grid" role="group" aria-label="预设背景">
              {backgrounds.map((background) => (
                <button
                  className={`preset ${selected === background.id ? "selected" : ""}`}
                  type="button"
                  key={background.id}
                  onClick={() => chooseBackground(background.id)}
                  aria-pressed={selected === background.id}
                >
                  <span className="preset-image" style={background.style}>
                    {selected === background.id && <Check size={20} strokeWidth={2.2} />}
                  </span>
                  <span className="preset-name">{background.name}</span>
                </button>
              ))}
            </div>
            <div className="upload-area">
              <label className="upload-button" htmlFor="background-upload">
                <ImagePlus size={19} strokeWidth={1.7} />
                {uploading ? "正在保存..." : "上传自定义照片"}
              </label>
              <input
                id="background-upload"
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(event) => {
                  void uploadBackground(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <span className="upload-hint">JPG、PNG、WebP</span>
            </div>
            {customUrl && (
              <div className="custom-preset-row">
                <button className={`custom-preset ${selected === customKey ? "selected" : ""}`} type="button" onClick={() => chooseBackground(customKey)} aria-pressed={selected === customKey}>
                  <span className="custom-thumbnail" style={{ backgroundImage: `url("${customUrl}")` }} />
                  <span>我的照片</span>
                  {selected === customKey && <Check size={18} />}
                </button>
                <button className="background-delete" type="button" aria-label="删除已上传的首页背景" title="删除已上传的背景" disabled={uploading} onClick={() => void removeCustomBackground()}><Trash2 size={17} /></button>
              </div>
            )}
            {uploadError && <p className="upload-error" role="alert">{uploadError}</p>}
          </aside>
        </div>
      )}
    </main>
  );
}
