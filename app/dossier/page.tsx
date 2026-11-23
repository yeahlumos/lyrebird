"use client";

import SettingsButton from "../_ui/settings-button";

import { BackgroundVideo, FollowHomeButton, backgroundAccept, backgroundFormatHint, backgroundImage, createBackgroundMedia, followHome, isBackgroundFile, useHomeBackground, type BackgroundMedia } from "../_background/media";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowLeft, ArrowUpRight, BriefcaseBusiness, Check, ChevronLeft, ChevronRight, Cpu, Download, FlaskConical, ImagePlus, Layers3, Pencil, Plus, Sparkles, Trash2, Trophy, UserRound, Wrench, X } from "lucide-react";
import "./dossier.css";
import { detailHref, dossierStorageKey, type Dossier, type Node, type Profile, type Project, type Social } from "./types";

type ArchiveItem = Node & { source?: "projects" | "experience" | "awards"; sourceId?: string; displayDate?: string };

const storageKey = dossierStorageKey;
const coverKey = "lyrebird-dossier-background";
const coverPrefix = "background:";
const coverPresets = [
  { id: "bird3", name: "飞鸟 3", url: "/bird3.jpg" },
  { id: "bird1", name: "飞鸟 1", url: "/Bird1.jpg" },
  { id: "bird2", name: "飞鸟 2", url: "/bird2.jpg" },
  { id: "miku", name: "初音未来", url: "/初音未来.jpg" },
  { id: "frieren", name: "芙莉莲", url: "/芙莉莲.jpg" },
];
const categories = ["硬件竞赛", "数模", "前端开发", "学习笔记", "其他"];
const skillGroups = [
  { id: "开发与技术", label: "开发与技术", icon: Cpu, tone: "teal" },
  { id: "硬件与工程", label: "硬件与工程", icon: Wrench, tone: "coral" },
  { id: "研究与方法", label: "研究与方法", icon: FlaskConical, tone: "blue" },
  { id: "工具与表达", label: "工具与表达", icon: Layers3, tone: "gold" },
  { id: "其他", label: "其他", icon: Sparkles, tone: "green" },
] as const;
const levelNames = ["未评级", "了解", "熟悉", "熟练", "深入", "专精"];
const empty: Dossier = {
  profile: { name: "", school: "", major: "", bio: "", avatar: "" },
  socials: [], experience: [], education: [], projects: [], awards: [], skillItems: [], categories, nodes: [],
};
const blankNode = (): Node => { const now = new Date(); return { id: crypto.randomUUID(), date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`, category: categories[0], title: "", summary: "", detail: "" }; };
const safeUrl = (value: string) => /^(https?:\/\/|mailto:)/i.test(value.trim()) ? value.trim() : undefined;

function archiveDate(value: string): string {
  const match = value.match(/(\d{4})(?:[.\-/年]\s*(\d{1,2})(?!\d))?(?:[.\-/月]\s*(\d{1,2})(?!\d))?/);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2] ?? 1);
  const day = Number(match[3] ?? 1);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "";
  return `${match[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function archiveItems(data: Dossier): ArchiveItem[] {
  return [
    ...data.nodes,
    ...data.projects.filter((item) => item.title.trim()).map((item) => ({ id: `project:${item.id}`, source: "projects" as const, sourceId: item.id, date: archiveDate(item.period), displayDate: item.period, category: "精选项目", title: item.title, summary: item.summary, detail: [item.role, item.stack, item.detail].filter(Boolean).join("\n") })),
    ...data.experience.filter((item) => item.organization.trim() || item.role.trim()).map((item) => ({ id: `experience:${item.id}`, source: "experience" as const, sourceId: item.id, date: archiveDate(item.period), displayDate: item.period, category: "工作与实践", title: item.organization || item.role, summary: item.role, detail: item.detail })),
    ...data.awards.filter((item) => item.title.trim()).map((item) => ({ id: `award:${item.id}`, source: "awards" as const, sourceId: item.id, date: archiveDate(item.date), displayDate: item.date, category: "荣誉与成果", title: item.title, summary: item.organizer, detail: item.detail })),
  ];
}

function openMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("lyrebird-dossier", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("media");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readAvatar(): Promise<Blob | undefined> {
  const db = await openMediaDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("media", "readonly").objectStore("media").get("avatar");
      request.onsuccess = () => resolve(request.result as Blob | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function readProjectImages(): Promise<{ id: string; blob: Blob }[]> {
  const db = await openMediaDb();
  try {
    return await new Promise((resolve, reject) => {
      const images: { id: string; blob: Blob }[] = [];
      const request = db.transaction("media", "readonly").objectStore("media").openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) { resolve(images); return; }
        if (typeof cursor.key === "string" && cursor.key.startsWith("project:") && cursor.value instanceof Blob) images.push({ id: cursor.key.slice(8), blob: cursor.value });
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function writeAvatar(file: File): Promise<void> {
  const db = await openMediaDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("media", "readwrite");
      transaction.objectStore("media").put(file, "avatar");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

async function readCovers(): Promise<{ id: string; blob: Blob }[]> {
  const db = await openMediaDb();
  try {
    return await new Promise((resolve, reject) => {
      const covers: { id: string; blob: Blob }[] = [];
      const request = db.transaction("media", "readonly").objectStore("media").openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) { resolve(covers); return; }
        if (typeof cursor.key === "string" && cursor.key.startsWith(coverPrefix) && cursor.value instanceof Blob) covers.push({ id: cursor.key, blob: cursor.value });
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function changeStoredCover(id: string, file?: File): Promise<void> {
  const db = await openMediaDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("media", "readwrite");
      if (file) transaction.objectStore("media").put(file, id);
      else transaction.objectStore("media").delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

export default function DossierPage() {
  const router = useRouter();
  const [data, setData] = useState<Dossier>(empty);
  const [syncedProjects, setSyncedProjects] = useState<Project[]>([]);
  const [view, setView] = useState<"portfolio" | "timeline">("portfolio");
  const [editing, setEditing] = useState(true);
  const [filter, setFilter] = useState("全部");
  const [saveError, setSaveError] = useState("");
  const [selectedCover, setSelectedCover] = useState(followHome);
  const homeBackground = useHomeBackground();
  const [coverMenuOpen, setCoverMenuOpen] = useState(false);
  const [storedCovers, setStoredCovers] = useState<({ id: string; name: string } & BackgroundMedia)[]>([]);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [projectImages, setProjectImages] = useState<Record<string, string>>({});
  const [newCategory, setNewCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [calendarYear, setCalendarYear] = useState(0);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const avatarUrlRef = useRef("");
  const coverUrlsRef = useRef<string[]>([]);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { scrollY } = useScroll();
  const heroOffset = useTransform(scrollY, [0, 650], [0, 160]);

  useEffect(() => { queueMicrotask(() => setCalendarYear(new Date().getFullYear())); }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/projects/sync", { cache: "no-store" }).then((response) => response.json()).then((value: unknown) => {
      if (active && Array.isArray(value)) setSyncedProjects(value.filter((item): item is Project => Boolean(item && typeof item.id === "string" && typeof item.title === "string")));
    }).catch(() => { /* Browser-only records remain available when the sync server is offline. */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    readCovers().then((covers) => {
      if (!active) return;
      const loaded = covers.map(({ id, blob }) => {
        const media = createBackgroundMedia(blob);
        coverUrlsRef.current.push(media.url);
        return { id, name: blob instanceof File ? blob.name : "已上传背景", ...media };
      });
      setStoredCovers(loaded);
      const saved = localStorage.getItem(coverKey);
      if (saved === "see-you") localStorage.removeItem(coverKey);
      if (saved && (saved === followHome || coverPresets.some((item) => item.id === saved) || loaded.some((item) => item.id === saved))) setSelectedCover(saved);
    }).catch(() => { if (active) setCoverError("背景读取失败，请刷新重试。"); });
    return () => { active = false; coverUrlsRef.current.forEach(URL.revokeObjectURL); coverUrlsRef.current = []; };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      if (!localStorage.getItem("lyrebird-atelier")) localStorage.setItem("lyrebird-atelier", raw);
      const saved = JSON.parse(raw) as Partial<Dossier>;
      if (!saved || typeof saved !== "object" || !saved.profile) return;
      queueMicrotask(() => {
        setData({
          profile: { ...empty.profile, ...saved.profile },
          socials: Array.isArray(saved.socials) ? saved.socials : [],
          experience: Array.isArray(saved.experience) ? saved.experience : [],
          education: Array.isArray(saved.education) ? saved.education : [],
          projects: Array.isArray(saved.projects) ? saved.projects : [],
          awards: Array.isArray(saved.awards) ? saved.awards : [],
          skillItems: Array.isArray(saved.skillItems) ? saved.skillItems : typeof (saved as Dossier & { skills?: string }).skills === "string"
            ? (saved as Dossier & { skills: string }).skills.split(/[,，\n]/).map((name) => name.trim()).filter(Boolean).map((name) => ({ id: crypto.randomUUID(), name, group: "其他", level: 0 })) : [],
          categories: Array.isArray(saved.categories) ? [...new Set([...categories, ...saved.categories.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))])] : categories,
          nodes: Array.isArray(saved.nodes) ? saved.nodes : [],
        });
        setEditing(false);
      });
    } catch { /* Keep the empty editor available if local data is invalid. */ }
  }, []);

  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    readProjectImages().then((images) => {
      if (!active) return;
      const next: Record<string, string> = {};
      images.forEach(({ id, blob }) => { const url = URL.createObjectURL(blob); urls.push(url); next[id] = url; });
      setProjectImages(next);
    }).catch(() => { if (active) setSaveError("项目配图读取失败，请刷新重试。"); });
    return () => { active = false; urls.forEach(URL.revokeObjectURL); };
  }, []);

  useEffect(() => {
    let active = true;
    readAvatar().then((blob) => {
      if (!active || !blob) return;
      const url = URL.createObjectURL(blob);
      avatarUrlRef.current = url;
      setAvatarUrl(url);
      const request = indexedDB.open("lyrebird-atelier", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("media");
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction("media", "readwrite");
        const store = transaction.objectStore("media");
        const existing = store.get("avatar");
        existing.onsuccess = () => { if (!existing.result) store.put(blob, "avatar"); };
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => db.close();
      };
    }).catch(() => { if (active) setSaveError("头像读取失败，请重新上传。"); });
    return () => { active = false; if (avatarUrlRef.current) URL.revokeObjectURL(avatarUrlRef.current); };
  }, []);

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setSaveError("请选择 JPG、PNG 或 WebP 图片。"); return; }
    setAvatarBusy(true);
    try {
      await writeAvatar(file);
      const url = URL.createObjectURL(file);
      if (avatarUrlRef.current) URL.revokeObjectURL(avatarUrlRef.current);
      avatarUrlRef.current = url;
      setAvatarUrl(url);
      setSaveError("");
    } catch { setSaveError("头像保存失败，请检查浏览器存储空间。"); }
    finally { setAvatarBusy(false); }
  };

  const save = (next: Dossier) => {
    setData(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaveError(""); }
    catch { setSaveError("本地保存失败，请检查浏览器存储空间。"); }
  };
  const profile = (field: keyof Profile, value: string) => save({ ...data, profile: { ...data.profile, [field]: value } });
  const updateItem = <T extends { id: string }>(key: "socials", id: string, field: keyof T, value: string) => {
    const items = data[key].map((item) => item.id === id ? { ...item, [field]: value } : item);
    save({ ...data, [key]: items });
  };
  const removeItem = (id: string) => save({ ...data, socials: data.socials.filter((item) => item.id !== id) });
  const addRecord = (kind: "project" | "skill" | "experience" | "education" | "award" | "node", group = "其他") => {
    const id = crypto.randomUUID();
    if (kind === "project") save({ ...data, projects: [...data.projects, { id, title: "", period: "", role: "", stack: "", summary: "", detail: "", url: "" }] });
    if (kind === "skill") save({ ...data, skillItems: [...data.skillItems, { id, name: "", group, level: 0, description: "" }] });
    if (kind === "experience") save({ ...data, experience: [...data.experience, { id, organization: "", role: "", period: "", detail: "" }] });
    if (kind === "education") save({ ...data, education: [...data.education, { id, school: "", program: "", period: "", detail: "" }] });
    if (kind === "award") save({ ...data, awards: [...data.awards, { id, title: "", organizer: "", date: "", detail: "" }] });
    if (kind === "node") save({ ...data, nodes: [...data.nodes, { ...blankNode(), id }] });
    router.push(detailHref(kind, id));
  };
  const addCategory = () => {
    const value = newCategory.trim();
    if (!value || data.categories.includes(value)) return;
    save({ ...data, categories: [...data.categories, value] });
    setFilter(value);
    setNewCategory("");
    setAddingCategory(false);
  };

  const allProjects = [
    ...data.projects.map((item) => {
      const synced = syncedProjects.find((project) => project.id === item.id);
      return synced ? { ...synced, ...item, files: synced.files, readme: synced.readme, readmePath: synced.readmePath, cover: synced.cover, showcase: synced.showcase } : item;
    }),
    ...syncedProjects.filter((item) => !data.projects.some((local) => local.id === item.id)),
  ];
  const allNodes = archiveItems({ ...data, projects: allProjects });
  const archiveCategories = [...new Set([...data.categories, ...allNodes.map((node) => node.category)])];
  const visibleNodes = allNodes.filter((node) =>
    (filter === "全部" || node.category === filter) &&
    (!selectedDate || node.date === selectedDate) &&
    (!selectedPeriod || node.date.startsWith(selectedPeriod))
  ).sort((a, b) => b.date.localeCompare(a.date));
  const calendarCounts = new Map<string, number>();
  allNodes.forEach((node) => { if (node.date) calendarCounts.set(node.date, (calendarCounts.get(node.date) ?? 0) + 1); });
  const firstDay = new Date(calendarYear, 0, 1);
  const calendarOffset = (firstDay.getDay() + 6) % 7;
  const totalDays = Math.round((new Date(calendarYear + 1, 0, 1).getTime() - firstDay.getTime()) / 86400000);
  const calendarDays = Array.from({ length: calendarOffset + totalDays }, (_, index) => {
    if (index < calendarOffset) return "";
    const date = new Date(calendarYear, 0, index - calendarOffset + 1);
    return `${calendarYear}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
  const monthMarkers = Array.from({ length: 12 }, (_, month) => ({
    month: month + 1,
    column: Math.floor((calendarOffset + Math.round((new Date(calendarYear, month, 1).getTime() - firstDay.getTime()) / 86400000)) / 7) + 1,
  }));
  const chooseCover = (id: string) => {
    setSelectedCover(id);
    localStorage.setItem(coverKey, id);
    setCoverMenuOpen(false);
  };
  const uploadCover = async (file?: File) => {
    if (!file) return;
    if (!isBackgroundFile(file)) { setCoverError(`请选择 ${backgroundFormatHint} 文件。`); return; }
    setCoverBusy(true);
    setCoverError("");
    try {
      const id = `${coverPrefix}${crypto.randomUUID()}`;
      await changeStoredCover(id, file);
      const media = createBackgroundMedia(file);
      coverUrlsRef.current.push(media.url);
      setStoredCovers((current) => [...current, { id, name: file.name, ...media }]);
      chooseCover(id);
    } catch { setCoverError("背景保存失败，请检查浏览器存储空间。"); }
    finally { setCoverBusy(false); }
  };
  const removeCover = async (cover: { id: string; name: string; url: string }) => {
    if (!window.confirm("删除这张已上传的背景照片？")) return;
    setCoverBusy(true);
    setCoverError("");
    try {
      await changeStoredCover(cover.id);
      if (selectedCover === cover.id) chooseCover(followHome);
      setStoredCovers((current) => current.filter((item) => item.id !== cover.id));
      coverUrlsRef.current = coverUrlsRef.current.filter((url) => url !== cover.url);
      URL.revokeObjectURL(cover.url);
    } catch { setCoverError("删除失败，请稍后重试。"); }
    finally { setCoverBusy(false); }
  };
  const activeCover = selectedCover === followHome ? homeBackground : [...coverPresets, ...storedCovers].find((item) => item.id === selectedCover);
  let lastYear = "";
  let lastMonth = "";
  const displaySkills = data.skillItems.filter((skill) => skill.name.trim());

  return <main className="dossier-page">
    <header className="dossier-topbar">
      <Link href="/" className="dossier-back" aria-label="返回主页" title="返回主页"><ArrowLeft size={19} /></Link>
      <div className="dossier-switch" role="tablist" aria-label="航迹视图">
        {([ ["portfolio", "履历与作品集"], ["timeline", "成长归档"] ] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}>
          {view === id && <motion.span className="dossier-switch-active" layoutId="dossier-switch" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
          <span>{label}</span>
        </button>)}
      </div>
      <div className="dossier-top-actions">
        {view === "portfolio" && <>
          <button type="button" className="dossier-icon-button" aria-label={editing ? "切换纯净预览" : "切换编辑模式"} title={editing ? "纯净预览" : "编辑模式"} onClick={() => setEditing(!editing)}>{editing ? <Check size={18} /> : <Pencil size={17} />}</button>
          <button type="button" className="dossier-icon-button" aria-label="打印或导出 PDF" title="打印 / 导出 PDF" onClick={() => { setEditing(false); requestAnimationFrame(() => window.print()); }}><Download size={18} /></button>
        </>}
      </div>
    </header>

    <section className="dossier-hero" aria-label={view === "portfolio" ? "航迹封面" : "成长归档封面"}>
      <motion.div className="dossier-hero-image" style={{ y: heroOffset, backgroundImage: backgroundImage(activeCover) }}><BackgroundVideo media={activeCover} /></motion.div>
      <div className="dossier-hero-shade" />
      <div className="dossier-hero-content"><span>航迹 / Trajectory</span><h1>{view === "portfolio" ? "履历与作品集" : "成长归档"}</h1><p>{view === "portfolio" ? "个人经历与作品" : `${allNodes.length} 个项目与学习节点`}</p></div>
      <div className="dossier-cover-settings">
        <SettingsButton className="ml-auto" type="button" aria-label="更换航迹背景" title="更换背景" aria-expanded={coverMenuOpen} onClick={() => setCoverMenuOpen(!coverMenuOpen)} />
        {coverMenuOpen && <div className="dossier-cover-panel">
          <div className="dossier-cover-panel-head"><strong>背景设置</strong><button type="button" aria-label="关闭背景设置" title="关闭" onClick={() => setCoverMenuOpen(false)}><X size={16} /></button></div>
          <FollowHomeButton active={selectedCover === followHome} onSelect={() => chooseCover(followHome)} />
          <div className="dossier-cover-grid">
            {coverPresets.map((cover) => <button type="button" key={cover.id} className={`dossier-cover-choice ${selectedCover === cover.id ? "selected" : ""}`} aria-pressed={selectedCover === cover.id} onClick={() => chooseCover(cover.id)}>
              <span style={{ backgroundImage: `url("${cover.url}")` }}>{selectedCover === cover.id && <Check size={17} />}</span><small>{cover.name}</small>
            </button>)}
            {storedCovers.map((cover, index) => <div className="dossier-cover-saved" key={cover.id}>
              <button type="button" className={`dossier-cover-choice ${selectedCover === cover.id ? "selected" : ""}`} aria-label={`使用已上传背景 ${index + 1}`} aria-pressed={selectedCover === cover.id} onClick={() => chooseCover(cover.id)}>
                <span className="relative" style={{ backgroundImage: backgroundImage(cover) }}><BackgroundVideo media={cover} preview />{selectedCover === cover.id && <Check className="relative" size={17} />}</span><small title={cover.name}>{cover.name}</small>
              </button>
              <button className="dossier-cover-delete" type="button" aria-label={`删除已上传背景 ${cover.name}`} title="删除已上传的背景" disabled={coverBusy} onClick={() => void removeCover(cover)}><Trash2 size={14} /></button>
            </div>)}
          </div>
          <label className="dossier-cover-upload" htmlFor="dossier-cover-file"><ImagePlus size={16} />上传背景</label>
          <input id="dossier-cover-file" className="visually-hidden" type="file" accept={backgroundAccept} disabled={coverBusy} onChange={(event) => { void uploadCover(event.target.files?.[0]); event.target.value = ""; }} />
          {coverError && <p role="alert">{coverError}</p>}
        </div>}
      </div>
    </section>

    {saveError && <p className="dossier-save-error" role="alert">{saveError}</p>}

    <div className="dossier-portfolio" hidden={view !== "portfolio"}>
      <div className="dossier-content">
        <section className="dossier-intro">
          <div className="dossier-avatar-shell">
            <div className="dossier-avatar">{avatarUrl || data.profile.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={avatarUrl || data.profile.avatar} src={avatarUrl || data.profile.avatar} alt="个人头像" onError={(event) => { event.currentTarget.style.display = "none"; }} />
            ) : <UserRound size={36} strokeWidth={1.2} aria-hidden="true" />}</div>
            <button className="dossier-avatar-edit" type="button" aria-label="上传或更换头像" title="上传或更换头像" disabled={avatarBusy} onClick={() => avatarInputRef.current?.click()}><Pencil size={16} /></button>
            <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="选择头像照片" onChange={(event) => { void uploadAvatar(event.target.files?.[0]); event.target.value = ""; }} />
          </div>
          <div className="dossier-intro-copy">
            <span className="dossier-eyebrow">航迹 / Trajectory</span>
            {editing ? <div className="dossier-edit-stack">
              <input aria-label="姓名" placeholder="姓名" value={data.profile.name} onChange={(event) => profile("name", event.target.value)} />
              <div className="dossier-edit-row"><input aria-label="院校" placeholder="院校" value={data.profile.school} onChange={(event) => profile("school", event.target.value)} /><input aria-label="专业" placeholder="专业" value={data.profile.major} onChange={(event) => profile("major", event.target.value)} /></div>
            </div> : <><h1>{data.profile.name || "航迹"}</h1><p className="dossier-subtitle">{[data.profile.school, data.profile.major].filter(Boolean).join(" · ")}</p></>}
            <div className="dossier-socials">
              {data.socials.map((social) => editing ? <div className="dossier-social-edit" key={social.id}><input aria-label="链接名称" placeholder="链接名称" value={social.label} onChange={(event) => updateItem<Social>("socials", social.id, "label", event.target.value)} /><input aria-label="链接地址" placeholder="https://..." value={social.url} onChange={(event) => updateItem<Social>("socials", social.id, "url", event.target.value)} /><button type="button" aria-label="删除链接" title="删除链接" onClick={() => removeItem(social.id)}><Trash2 size={15} /></button></div> : safeUrl(social.url) && <a href={safeUrl(social.url)} target="_blank" rel="noopener noreferrer" key={social.id}>{social.label || "链接"}<ArrowUpRight size={14} /></a>)}
              {editing && <button type="button" className="dossier-add-inline" onClick={() => save({ ...data, socials: [...data.socials, { id: crypto.randomUUID(), label: "", url: "" }] })}><Plus size={15} />添加链接</button>}
            </div>
          </div>
        </section>

        <section className="dossier-section dossier-about" aria-labelledby="about-title">
          <div className="dossier-section-heading"><h2 id="about-title">关于我</h2></div>
          {editing ? <textarea aria-label="个人简介" placeholder="简要介绍你的方向、经历与目标" value={data.profile.bio} onChange={(event) => profile("bio", event.target.value)} /> : <p>{data.profile.bio || "暂无简介"}</p>}
        </section>

        <section className="dossier-section" aria-labelledby="experience-title"><div className="dossier-section-heading"><h2 id="experience-title">工作与实践</h2>{editing && <button type="button" onClick={() => addRecord("experience")}><Plus size={16} />添加</button>}</div>
          {data.experience.length ? data.experience.map((item) => <div className="dossier-line-item dossier-experience-item" key={item.id}>
            <span className="dossier-entry-mark"><BriefcaseBusiness size={17} /></span>
            <Link className="dossier-entry-open" href={detailHref("experience", item.id)} aria-label={`查看${item.organization || item.role || "工作经历"}详情`}><span className="dossier-line-main"><strong>{item.organization || item.role || "未命名经历"}</strong><small>{item.period}</small></span><span className="dossier-entry-subtitle">{item.role}</span><span className="dossier-entry-excerpt">{item.detail}</span><ChevronRight size={17} aria-hidden="true" /></Link>
          </div>) : <p className="dossier-empty">{editing ? "添加一段工作或实践经历" : "暂无经历"}</p>}
        </section>

        <section className="dossier-section" aria-labelledby="education-title"><div className="dossier-section-heading"><h2 id="education-title">教育背景</h2>{editing && <button type="button" onClick={() => addRecord("education")}><Plus size={16} />添加</button>}</div>
          {data.education.length ? data.education.map((item) => <div className="dossier-line-item dossier-experience-item" key={item.id}><span className="dossier-entry-mark"><Layers3 size={17} /></span><Link className="dossier-entry-open" href={detailHref("education", item.id)} aria-label={`查看${item.school || "教育经历"}详情`}><span className="dossier-line-main"><strong>{item.school || "未命名学校"}</strong><small>{item.period}</small></span><span className="dossier-entry-subtitle">{item.program}</span><span className="dossier-entry-excerpt">{item.detail}</span><ChevronRight size={17} aria-hidden="true" /></Link></div>) : <p className="dossier-empty">{editing ? "添加一段教育经历" : "暂无教育经历"}</p>}
        </section>

        <section className="dossier-section" aria-labelledby="projects-title"><div className="dossier-section-heading"><h2 id="projects-title">精选项目</h2>{editing && <button type="button" onClick={() => addRecord("project")}><Plus size={16} />添加</button>}</div>
          <div className="dossier-project-list">{allProjects.map((item) => <article className="dossier-project" key={item.id}>
            <Link className="dossier-project-open" href={detailHref("project", item.id)} aria-label={`查看${item.title || "项目"}详情`}>
              {(projectImages[item.id] || item.cover) && <div className="dossier-project-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={projectImages[item.id] || item.cover} alt={`${item.title || "项目"}封面`} />
              </div>}
              <div className="dossier-project-body"><div className="dossier-project-top"><h3>{item.title || "未命名项目"}</h3><span>{item.period}</span></div>{item.role && <p className="dossier-role">{item.role}</p>}{item.summary && <p className="dossier-project-excerpt">{item.summary}</p>}<div className="dossier-tags">{item.stack.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</div><span className="dossier-project-read">查看详情 <ChevronRight size={15} /></span></div>
            </Link>
            {item.detail && <p className="dossier-project-print-detail">{item.detail}</p>}
          </article>)}<button type="button" className="dossier-project-create" onClick={() => addRecord("project")} aria-label="新建项目"><Plus size={23} /><span>新建项目</span></button></div>
        </section>

        <section className="dossier-section dossier-skills-section" aria-labelledby="skills-title">
          <div className="dossier-section-heading"><h2 id="skills-title">技能树</h2><span className="dossier-skill-count">{displaySkills.length} 项技能</span></div>
          <div className="dossier-skill-map">
            <div className="dossier-skill-branches">
              {skillGroups.map((group) => {
                const items = data.skillItems.filter((skill) => skill.group === group.id);
                const Icon = group.icon;
                return (editing || items.length > 0) && <div className={`dossier-skill-branch tone-${group.tone}`} key={group.id}>
                  <div className="dossier-skill-branch-head"><span className="dossier-skill-branch-icon"><Icon size={18} strokeWidth={1.7} /></span><div><h3>{group.label}</h3><span>{items.filter((item) => item.name.trim()).length} 项</span></div></div>
                  <div className="dossier-skill-list">
                    {items.map((skill) => <Link className="dossier-skill-item" href={detailHref("skill", skill.id)} key={skill.id} aria-label={`查看${skill.name || "技能"}详情`}><span className="dossier-skill-name">{skill.name || "未命名技能"}</span><span className="dossier-skill-description">{skill.description}</span><span className="dossier-skill-level" aria-label={levelNames[skill.level] || "未评级"}><span>{levelNames[skill.level] || "未评级"}</span><span className="dossier-skill-bars" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <i className={index < skill.level ? "filled" : ""} key={index} />)}</span></span><ChevronRight size={16} aria-hidden="true" /></Link>)}
                    {editing && <button className="dossier-skill-add" type="button" onClick={() => addRecord("skill", group.id)}><Plus size={15} />添加技能</button>}
                  </div>
                </div>;
              })}
            </div>
            {!editing && !displaySkills.length && <p className="dossier-empty dossier-skill-empty">暂无技能</p>}
          </div>
        </section>
        <section className="dossier-section" aria-labelledby="awards-title"><div className="dossier-section-heading"><h2 id="awards-title">荣誉与成果</h2>{editing && <button type="button" onClick={() => addRecord("award")}><Plus size={16} />添加</button>}</div>
          {data.awards.length ? data.awards.map((item) => <div className="dossier-line-item dossier-experience-item" key={item.id}><span className="dossier-entry-mark"><Trophy size={17} /></span><Link className="dossier-entry-open" href={detailHref("award", item.id)} aria-label={`查看${item.title || "荣誉"}详情`}><span className="dossier-line-main"><strong>{item.title || "未命名荣誉"}</strong><small>{item.date}</small></span><span className="dossier-entry-subtitle">{item.organizer}</span><span className="dossier-entry-excerpt">{item.detail}</span><ChevronRight size={17} aria-hidden="true" /></Link></div>) : <p className="dossier-empty">{editing ? "添加荣誉或成果" : "暂无荣誉"}</p>}
        </section>
        <section className="dossier-contact" aria-labelledby="contact-title"><span className="dossier-eyebrow">CONTACT</span><h2 id="contact-title">保持联系</h2><div className="dossier-contact-links">{data.socials.filter((social) => safeUrl(social.url)).map((social) => <a href={safeUrl(social.url)} target="_blank" rel="noopener noreferrer" key={social.id}>{social.label || "链接"}<ArrowUpRight size={15} /></a>)}</div>{!data.socials.length && <p className="dossier-empty">{editing ? "在顶部添加社交链接" : "暂无联系方式"}</p>}</section>
      </div>
    </div>

    {view === "timeline" && <div className="dossier-archive">
      <section className="dossier-calendar" aria-label="归档日历">
        <div className="dossier-calendar-heading"><h2>记录日历</h2><div><button type="button" aria-label="上一年" title="上一年" onClick={() => { setCalendarYear(calendarYear - 1); setSelectedDate(""); }}><ChevronLeft size={18} /></button><span>{calendarYear}</span><button type="button" aria-label="下一年" title="下一年" onClick={() => { setCalendarYear(calendarYear + 1); setSelectedDate(""); }}><ChevronRight size={18} /></button></div></div>
        <div className="dossier-calendar-scroll"><div className="dossier-calendar-layout"><div className="dossier-calendar-weekdays">{["一", "二", "三", "四", "五", "六", "日"].map((day) => <span key={day}>{day}</span>)}</div><div><div className="dossier-calendar-months">{monthMarkers.map(({ month, column }) => <span key={month} style={{ gridColumn: column }}>{month}月</span>)}</div><div className="dossier-calendar-grid">{calendarDays.map((day, index) => day ? <button key={day} type="button" className={`dossier-calendar-day level-${Math.min(calendarCounts.get(day) ?? 0, 4)} ${selectedDate === day ? "selected" : ""}`} aria-label={`${day}，${calendarCounts.get(day) ?? 0} 条记录`} aria-pressed={selectedDate === day} title={`${day} · ${calendarCounts.get(day) ?? 0} 条记录`} onClick={() => { setSelectedDate(selectedDate === day ? "" : day); setSelectedPeriod(""); }} /> : <span key={`empty-${index}`} className="dossier-calendar-spacer" />)}</div></div></div></div>
        <div className="dossier-calendar-foot"><span>少</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} className={`level-${level}`} />)}<span>多</span></div>
      </section>
      <div className="dossier-archive-head"><div><span className="dossier-eyebrow">GROWTH ARCHIVE</span><p>共记录 {allNodes.length} 个项目与学习节点</p></div><button type="button" className="dossier-primary" onClick={() => addRecord("node")}><Plus size={17} />记录新节点</button></div>
      {(selectedDate || selectedPeriod) && <div className="dossier-archive-selection"><span>{selectedDate || selectedPeriod.replace("-", "年") + (selectedPeriod.length > 4 ? "月" : "")}</span><button type="button" aria-label="清除日期筛选" title="清除日期筛选" onClick={() => { setSelectedDate(""); setSelectedPeriod(""); }}><X size={15} /></button></div>}
      <div className="dossier-filters" role="group" aria-label="按标签筛选">{["全部", ...archiveCategories].map((category) => <button key={category} type="button" className={filter === category ? "active" : ""} aria-pressed={filter === category} onClick={() => setFilter(category)}>{category}</button>)}
        {addingCategory ? <form className="dossier-category-form" onSubmit={(event) => { event.preventDefault(); addCategory(); }}><input autoFocus aria-label="新标签名称" placeholder="新标签" maxLength={24} value={newCategory} onChange={(event) => setNewCategory(event.target.value)} /><button type="submit" aria-label="保存标签" title="保存标签" disabled={!newCategory.trim() || data.categories.includes(newCategory.trim())}><Check size={15} /></button><button type="button" aria-label="取消添加标签" title="取消" onClick={() => { setAddingCategory(false); setNewCategory(""); }}><X size={15} /></button></form> : <button className="dossier-category-add" type="button" onClick={() => setAddingCategory(true)}><Plus size={15} />添加标签</button>}
      </div>
      <div className="dossier-timeline">{visibleNodes.length ? visibleNodes.map((node, index) => {
        const [year, month] = node.date ? node.date.split("-") : ["未标日期", ""];
        const href = node.source && node.sourceId ? detailHref(node.source === "projects" ? "project" : node.source === "experience" ? "experience" : "award", node.sourceId) : detailHref("node", node.id);
        const showYear = year !== lastYear;
        const showMonth = showYear || month !== lastMonth;
        lastYear = year; lastMonth = month;
        return <div className="dossier-timeline-entry" key={node.id}>{showYear && <button type="button" className={`dossier-year ${selectedPeriod === year ? "active" : ""}`} aria-label={`筛选${year}年`} aria-pressed={selectedPeriod === year} onClick={() => { setSelectedPeriod(selectedPeriod === year ? "" : year); setSelectedDate(""); }}>{year}</button>}{showMonth && month && <button type="button" className={`dossier-month ${selectedPeriod === `${year}-${month}` ? "active" : ""}`} aria-label={`筛选${year}年${Number(month)}月`} aria-pressed={selectedPeriod === `${year}-${month}`} onClick={() => { setSelectedPeriod(selectedPeriod === `${year}-${month}` ? "" : `${year}-${month}`); setSelectedDate(""); }}>{Number(month)}月</button>}
          <article className={`dossier-node ${index % 2 ? "dossier-node-left" : "dossier-node-right"}`}><span className="dossier-node-dot" aria-hidden="true" /><Link className="dossier-node-main" href={href}><span className="dossier-node-date">{node.displayDate || node.date || "未填写时间"}</span><span className="dossier-node-title">{node.title}</span><span className="dossier-node-category">{node.category}</span>{node.summary && <span className="dossier-node-summary">{node.summary}</span>}</Link>
          </article></div>;
      }) : <p className="dossier-empty dossier-archive-empty">{allNodes.length ? "这个分类还没有记录" : "尚无归档节点"}</p>}</div>
    </div>}

  </main>;
}
