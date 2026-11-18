"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BackgroundVideo, backgroundAccept, backgroundFormatHint, backgroundImage, createBackgroundMedia, homeBackgroundKey as preferenceKey, homeUploadId as customKey, homeUploadRevisionKey, isBackgroundFile, readBackgroundUpload, writeBackgroundUpload, type BackgroundMedia } from "./_background/media";
import { useCardEntrance } from "./_home/use-card-entrance";
import { useHeroEntrance } from "./_home/use-hero-entrance";
import { useHomeVideo } from "./_home/use-home-video";
import { useSectionWheel } from "./_home/use-section-wheel";
import "./_home/home-motion.css";
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
  Volume2,
  VolumeX,
  X,
} from "lucide-react";


type BackgroundPreset = { id: string; name: string; style?: React.CSSProperties; media?: BackgroundMedia };

const backgrounds: readonly BackgroundPreset[] = [
  { id: "bird3", name: "飞鸟 3", style: { backgroundImage: 'url("/bird3.jpg")' } },
  { id: "bird1", name: "飞鸟 1", style: { backgroundImage: 'url("/Bird1.jpg")' } },
  { id: "bird2", name: "飞鸟 2", style: { backgroundImage: 'url("/bird2.jpg")' } },
  { id: "miku", name: "初音未来", style: { backgroundImage: 'url("/初音未来.jpg")' } },
  { id: "frieren", name: "芙莉莲", style: { backgroundImage: 'url("/芙莉莲.jpg")' } },
  { id: "mist", name: "薄雾", style: { background: "linear-gradient(135deg, #658c86 0%, #a9c7bd 46%, #d3dbca 100%)" } },
  { id: "dusk", name: "暮色", style: { background: "linear-gradient(135deg, #24404b 0%, #747b85 52%, #ba9b97 100%)" } },
  { id: "shoujo-ed", name: "少终ED（视频）", media: { url: "/backgrounds/shoujo-ed.mp4", video: true } },
];

const sections = [
  { number: "01", title: "Gleam / 浮光", description: "灵感记录空间", icon: Sparkles, className: "gleam" },
  { number: "02", title: "Solitude / 独白", description: "记录每一天", icon: NotebookPen, className: "diary" },
  { number: "03", title: "Dossier / 个人志", description: "履历与成长归档", icon: FolderOpen, className: "dossier" },
  { number: "04", title: "Atelier / 造物", description: "项目与学习", icon: BookOpenText, className: "atelier" },
  { number: "05", title: "Resonance / 共鸣", description: "即将开启", icon: Orbit, className: "resonance" },
  { number: "06", title: "Gravity / 引力场", description: "即将开启", icon: Radar, className: "gravity" },
  { number: "07", title: "Hollow / 树洞", description: "即将开启", icon: HeartHandshake, className: "hollow" },
] as const;

export default function Home() {
  const [selected, setSelected] = useState("bird3");
  const [customMedia, setCustomMedia] = useState<BackgroundMedia>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const customUrlRef = useRef<string | undefined>(undefined);
  const homeRef = useRef<HTMLElement>(null);
  const spacesGridRef = useRef<HTMLDivElement>(null);
  useCardEntrance(spacesGridRef);
  const heroEntrance = useHeroEntrance(homeRef);
  useSectionWheel(homeRef, settingsOpen);
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
    readBackgroundUpload(customKey)
      .then((blob) => {
        if (!active) return;
        if (!blob) {
          if (saved === customKey) localStorage.removeItem(preferenceKey);
          return;
        }
        const media = createBackgroundMedia(blob);
        customUrlRef.current = media.url;
        setCustomMedia(media);
        if (saved === customKey) setSelected(customKey);
      })
      .catch(() => {
        if (active && saved === customKey) setUploadError("无法读取已保存的背景，请重新上传。");
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
    if (!isBackgroundFile(file)) {
      setUploadError(`请选择 ${backgroundFormatHint} 文件。`);
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      await writeBackgroundUpload(customKey, file);
      const media = createBackgroundMedia(file);
      if (customUrlRef.current) URL.revokeObjectURL(customUrlRef.current);
      customUrlRef.current = media.url;
      setCustomMedia(media);
      chooseBackground(customKey);
      localStorage.setItem(homeUploadRevisionKey, crypto.randomUUID());
    } catch {
      setUploadError("背景保存失败，请检查浏览器存储空间后重试。");
    } finally {
      setUploading(false);
    }
  };

  const removeCustomBackground = async () => {
    if (!window.confirm("删除已上传的首页背景？")) return;
    setUploading(true);
    setUploadError("");
    try {
      await writeBackgroundUpload(customKey);
      if (selected === customKey) chooseBackground("bird3");
      if (customUrlRef.current) URL.revokeObjectURL(customUrlRef.current);
      customUrlRef.current = undefined;
      setCustomMedia(undefined);
    } catch {
      setUploadError("删除失败，请稍后重试。");
    } finally {
      setUploading(false);
    }
  };

  const selectedBackground = backgrounds.find((background) => background.id === selected);
  const activeMedia = selected === customKey ? customMedia : selectedBackground?.media;
  const videoSource = activeMedia?.video ? activeMedia.url : undefined;
  const { videoRef, soundOff, toggleSound } = useHomeVideo(videoSource);
  const SoundIcon = soundOff ? VolumeX : Volume2;
  const image = backgroundImage(activeMedia);
  const heroStyle = image ? { backgroundImage: image } : selectedBackground?.style ?? backgrounds[0].style;

  return (
    <main ref={homeRef}>
      <section data-scroll-section className="hero" aria-labelledby="site-title">
        <div className="hero-image" style={heroStyle}>
          {videoSource && <video key={videoSource} ref={videoRef} className="pointer-events-none absolute inset-0 h-full w-full object-cover" src={videoSource} loop playsInline preload="metadata" aria-hidden="true" />}
        </div>
        <div className="hero-shade" />
        <div className="hero-topline">
          <span className="topline-mark">LYREBIRD <span>琴鸟</span></span>
          <div className="hero-actions">
            {videoSource && <button
              type="button"
              className="settings-trigger sound-trigger"
              aria-label="视频静音"
              aria-pressed={soundOff}
              title={soundOff ? "开启视频声音" : "静音"}
              onClick={toggleSound}
            >
              <SoundIcon size={21} strokeWidth={1.7} />
            </button>}
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
        </div>

        <div className="hero-content" key={heroEntrance} data-entrance={heroEntrance}>
          <h1 id="site-title">Lyrebird</h1>
          <span className="hero-divider" aria-hidden="true" />
          <p><span className="hero-type">for you, a thousand times over</span></p>
        </div>

        <a className="scroll-cue" href="#spaces" aria-label="向下查看分区" title="查看分区">
          <ArrowDown size={25} strokeWidth={1.5} />
        </a>
      </section>

      <section data-scroll-section className="spaces min-h-svh" id="spaces" aria-labelledby="spaces-title">
        <div className="spaces-inner">
          <header className="spaces-heading">
            <span className="section-index">LYREBIRD / SPACES</span>
            <h2 id="spaces-title">my mind grows</h2>
          </header>
          <div className="spaces-grid" ref={spacesGridRef}>
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
                  <span className="preset-image relative" style={background.style}>
                    <BackgroundVideo media={background.media} preview />
                    {selected === background.id && <Check className="relative" size={20} strokeWidth={2.2} />}
                  </span>
                  <span className="preset-name">{background.name}</span>
                </button>
              ))}
            </div>
            <div className="upload-area">
              <label className="upload-button" htmlFor="background-upload">
                <ImagePlus size={19} strokeWidth={1.7} />
                {uploading ? "正在保存..." : "上传自定义背景"}
              </label>
              <input
                id="background-upload"
                className="visually-hidden"
                type="file"
                accept={backgroundAccept}
                disabled={uploading}
                onChange={(event) => {
                  void uploadBackground(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <span className="upload-hint">{backgroundFormatHint}</span>
            </div>
            {customMedia && (
              <div className="custom-preset-row">
                <button className={`custom-preset ${selected === customKey ? "selected" : ""}`} type="button" onClick={() => chooseBackground(customKey)} aria-pressed={selected === customKey}>
                  <span className="custom-thumbnail relative" style={{ backgroundImage: backgroundImage(customMedia) }}><BackgroundVideo media={customMedia} preview /></span>
                  <span>我的背景</span>
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
