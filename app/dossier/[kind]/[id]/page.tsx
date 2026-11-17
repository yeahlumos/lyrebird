"use client";
/* eslint-disable @next/next/no-img-element */

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Check, Download, ExternalLink, FileText, FolderUp, ImagePlus, Paperclip, Pencil, Trash2, X } from "lucide-react";
import { dossierStorageKey, type Award, type DetailKind, type Dossier, type Education, type Experience, type Node, type Project, type Skill } from "../../types";
import "./detail.css";

type DetailRecord = Project | Skill | Experience | Education | Award | Node;
type Attachment = { key?: string; name: string; path: string; type: string; url: string; size: number; blob?: Blob };
type StoredAttachment = { blob: Blob; path: string };
type UploadFile = { file: File; path: string };
type DropEntry = { isFile: boolean; isDirectory: boolean; name: string; file: (success: (file: File) => void, error: (error: DOMException) => void) => void; createReader: () => { readEntries: (success: (entries: DropEntry[]) => void, error: (error: DOMException) => void) => void } };

async function droppedFiles(items: DataTransferItemList): Promise<UploadFile[]> {
  const walk = async (entry: DropEntry, parent = ""): Promise<UploadFile[]> => {
    const relative = `${parent}${entry.name}`;
    if (entry.isFile) return [{ file: await new Promise<File>((resolve, reject) => entry.file(resolve, reject)), path: relative }];
    if (!entry.isDirectory) return [];
    const reader = entry.createReader();
    const children: DropEntry[] = [];
    while (true) {
      const batch = await new Promise<DropEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
      if (!batch.length) break;
      children.push(...batch);
    }
    return (await Promise.all(children.map((child) => walk(child, `${relative}/`)))).flat();
  };
  const entries = Array.from(items).map((item) => item.webkitGetAsEntry() as DropEntry | null).filter((entry): entry is DropEntry => entry !== null);
  return (await Promise.all(entries.map((entry) => walk(entry)))).flat();
}

const isImage = (file: Attachment) => /\.(png|jpe?g|webp)$/i.test(file.path) || /^(image\/png|image\/jpeg|image\/webp)$/.test(file.type);
const isText = (file: Attachment) => /\.(md|txt|ts|tsx|js|jsx|json|css|html|py|java|c|cpp|h|yml|yaml|xml|sh|mjs)$/i.test(file.path);

const collections = { project: "projects", skill: "skillItems", experience: "experience", education: "education", award: "awards", node: "nodes" } as const;
const labels = { project: "精选项目", skill: "技能", experience: "工作与实践", education: "教育背景", award: "荣誉与成果", node: "成长归档" } as const;
const levelNames = ["未评级", "了解", "熟悉", "熟练", "深入", "专精"];

function readDossier(): Dossier | null {
  try {
    const value = JSON.parse(localStorage.getItem(dossierStorageKey) ?? "null") as Dossier | null;
    return value && typeof value === "object" ? value : null;
  } catch { return null; }
}

function openMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("lyrebird-dossier", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("media")) request.result.createObjectStore("media");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readMedia(prefix: string, coverKey?: string) {
  const db = await openMediaDb();
  try {
    return await new Promise<{ attachments: { key: string; blob: Blob; path: string }[]; cover?: Blob }>((resolve, reject) => {
      const attachments: { key: string; blob: Blob; path: string }[] = [];
      const store = db.transaction("media", "readonly").objectStore("media");
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          if (!coverKey) { resolve({ attachments }); return; }
          const coverRequest = store.get(coverKey);
          coverRequest.onsuccess = () => resolve({ attachments, cover: coverRequest.result instanceof Blob ? coverRequest.result : undefined });
          coverRequest.onerror = () => reject(coverRequest.error);
          return;
        }
        if (typeof cursor.key === "string" && cursor.key.startsWith(prefix)) {
          const value = cursor.value as Blob | StoredAttachment;
          const blob = value instanceof Blob ? value : value?.blob;
          if (blob instanceof Blob) attachments.push({ key: cursor.key, blob, path: value instanceof Blob ? value instanceof File ? value.name : "附件" : value.path });
        }
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function writeMedia(files: UploadFile[], prefix: string) {
  const db = await openMediaDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("media", "readwrite");
      const store = transaction.objectStore("media");
      files.forEach(({ file, path }) => store.put({ blob: file, path } satisfies StoredAttachment, `${prefix}${crypto.randomUUID()}`));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

async function changeMedia(key: string, file?: File) {
  const db = await openMediaDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("media", "readwrite");
      if (file) transaction.objectStore("media").put(file, key);
      else transaction.objectStore("media").delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

const text = (record: DetailRecord, key: string) => String((record as unknown as Record<string, unknown>)[key] ?? "");
const safeUrl = (value: string) => /^(https?:\/\/|mailto:)/i.test(value.trim()) ? value.trim() : undefined;

export default function DossierDetailPage() {
  return <Suspense fallback={<main className="dossier-detail-page" />}><DetailContent /></Suspense>;
}

function DetailContent() {
  const router = useRouter();
  const params = useParams<{ kind: string; id: string }>();
  const kind = params.kind as DetailKind;
  const id = params.id;
  const validKind = Object.prototype.hasOwnProperty.call(collections, kind);
  const [record, setRecord] = useState<DetailRecord | null>(null);
  const [syncedProject, setSyncedProject] = useState<Project | null>(null);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [coverUrl, setCoverUrl] = useState("");
  const [mediaRevision, setMediaRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [previewText, setPreviewText] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const data = readDossier();
    const collection = validKind ? collections[kind] : null;
    const item = collection && Array.isArray(data?.[collection]) ? data[collection].find((entry) => entry.id === id) : null;
    if (kind !== "project") { queueMicrotask(() => { setRecord(item ?? null); setReady(true); }); return; }
    fetch("/api/projects/sync", { cache: "no-store" }).then((response) => response.json()).then((value: unknown) => {
      const synced = Array.isArray(value) ? value.find((project): project is Project => Boolean(project && project.id === id && typeof project.title === "string")) : null;
      setSyncedProject(synced ?? null);
      setRecord(item && synced ? { ...synced, ...item, files: synced.files, readme: synced.readme, cover: synced.cover } : item ?? synced ?? null);
    }).catch(() => setRecord(item ?? null)).finally(() => setReady(true));
  }, [kind, id, validKind]);

  useEffect(() => {
    if (!validKind) return;
    let active = true;
    const urls: string[] = [];
    readMedia(`attachment:${kind}:${id}:`, kind === "project" ? `project:${id}` : undefined).then(({ attachments: saved, cover }) => {
      if (!active) return;
      setAttachments(saved.map(({ key, blob, path }) => {
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return { key, name: path.split("/").at(-1) || "附件", path, type: blob.type, size: blob.size, url, blob };
      }));
      const url = cover ? URL.createObjectURL(cover) : "";
      if (url) urls.push(url);
      setCoverUrl(url);
    }).catch(() => { if (active) setError("文件读取失败，请刷新重试。"); });
    return () => { active = false; urls.forEach(URL.revokeObjectURL); };
  }, [kind, id, validKind, mediaRevision]);

  useEffect(() => {
    if (!preview || !isText(preview)) { queueMicrotask(() => setPreviewText("")); return; }
    let active = true;
    (preview.blob ? preview.blob.text() : fetch(preview.url).then((response) => { if (!response.ok) throw new Error(); return response.text(); }))
      .then((value) => { if (active) setPreviewText(value.slice(0, 500_000)); })
      .catch(() => { if (active) setPreviewText("文件预览失败，请下载查看。"); });
    return () => { active = false; };
  }, [preview]);

  const update = (field: string, value: string | number) => {
    const data = readDossier();
    if (!validKind) return;
    const base: Dossier = data ?? { profile: { name: "", school: "", major: "", bio: "", avatar: "" }, socials: [], experience: [], education: [], projects: [], awards: [], skillItems: [], categories: [], nodes: [] };
    const collection = collections[kind];
    const current = base[collection];
    const nextItems = current.some((item) => item.id === id) ? current.map((item) => item.id === id ? { ...item, [field]: value } : item) : [...current, { ...record, [field]: value } as never];
    const next = { ...base, [collection]: nextItems };
    try {
      localStorage.setItem(dossierStorageKey, JSON.stringify(next));
      const saved = nextItems.find((item) => item.id === id) ?? null;
      setRecord(kind === "project" && syncedProject && saved ? { ...syncedProject, ...saved, files: syncedProject.files, readme: syncedProject.readme, cover: syncedProject.cover } : saved);
      setError("");
    } catch { setError("保存失败，请检查浏览器存储空间。"); }
  };

  const uploadFiles = async (files: UploadFile[]) => {
    if (!files.length) return;
    if (files.some(({ file }) => file.size > 25 * 1024 * 1024)) { setError("单个文件不能超过 25 MB。"); return; }
    setBusy(true);
    setError("");
    try { await writeMedia(files, `attachment:${kind}:${id}:`); setMediaRevision((value) => value + 1); }
    catch { setError("文件保存失败，请检查浏览器存储空间。"); }
    finally { setBusy(false); }
  };

  const uploadCover = async (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("请选择 JPG、PNG 或 WebP 图片。"); return; }
    setBusy(true);
    setError("");
    try { await changeMedia(`project:${id}`, file); setMediaRevision((value) => value + 1); }
    catch { setError("封面保存失败，请检查浏览器存储空间。"); }
    finally { setBusy(false); }
  };

  const removeAttachment = async (key: string) => {
    if (!window.confirm("删除这个附件？")) return;
    setBusy(true);
    try { await changeMedia(key); setMediaRevision((value) => value + 1); }
    catch { setError("附件删除失败，请稍后重试。"); }
    finally { setBusy(false); }
  };

  const removeRecord = async () => {
    if (!window.confirm("删除这条记录及其上传的文件？")) return;
    const data = readDossier();
    if (!data || !validKind) return;
    setBusy(true);
    try {
      const db = await openMediaDb();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("media", "readwrite");
        const store = transaction.objectStore("media");
        const request = store.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          if (typeof cursor.key === "string" && (cursor.key.startsWith(`attachment:${kind}:${id}:`) || (kind === "project" && cursor.key === `project:${id}`))) cursor.delete();
          cursor.continue();
        };
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      db.close();
      const collection = collections[kind];
      localStorage.setItem(dossierStorageKey, JSON.stringify({ ...data, [collection]: data[collection].filter((item) => item.id !== id) }));
      router.push("/dossier");
    } catch { setError("删除失败，请稍后重试。"); setBusy(false); }
  };

  if (!ready) return <main className="dossier-detail-page" />;
  if (!record || !validKind) return <main className="dossier-detail-page"><div className="dossier-detail-missing"><Link href="/dossier"><ArrowLeft size={17} />返回个人志</Link><h1>记录不存在</h1></div></main>;

  const title = kind === "project" ? text(record, "title") : kind === "skill" ? text(record, "name") : kind === "experience" ? text(record, "organization") || text(record, "role") : kind === "education" ? text(record, "school") : text(record, "title");
  const period = kind === "award" || kind === "node" ? text(record, "date") : kind === "skill" ? text(record, "group") : text(record, "period");
  const subtitle = kind === "project" || kind === "experience" ? text(record, "role") : kind === "education" ? text(record, "program") : kind === "award" ? text(record, "organizer") : kind === "node" ? text(record, "category") : levelNames[Number(text(record, "level"))] || "未评级";
  const longText = kind === "project" ? text(record, "detail") : kind === "skill" ? text(record, "description") : text(record, "detail");
  const project = kind === "project" ? record as Project : null;
  const allFiles: Attachment[] = [...(project?.files ?? []).map((file) => ({ name: file.path.split("/").at(-1) || file.path, path: file.path, type: file.type, url: file.url, size: file.size })), ...attachments];
  const images = kind === "project" ? allFiles.filter(isImage) : [];
  const readme = allFiles.find((file) => file.path.toLowerCase() === "readme.md");
  const openPreview = (file: Attachment) => { setPreview(file); setPreviewText(""); };

  return <main className="dossier-detail-page">
    <header className="dossier-detail-nav">
      <Link href="/dossier" className="dossier-detail-back" aria-label="返回个人志" title="返回个人志"><ArrowLeft size={19} /></Link>
      <span>{labels[kind]}</span>
      <div className="dossier-detail-actions">
        <button type="button" title="上传文件" onClick={() => fileInputRef.current?.click()} disabled={busy}><Paperclip size={18} /><span>上传文件</span></button>
        <input ref={fileInputRef} type="file" multiple hidden aria-label="上传附件" onChange={(event) => { void uploadFiles(Array.from(event.target.files ?? []).map((file) => ({ file, path: file.name }))); event.target.value = ""; }} />
        {kind === "project" && <input ref={(element) => { folderInputRef.current = element; element?.setAttribute("webkitdirectory", ""); }} type="file" multiple hidden aria-label="上传文件夹" onChange={(event) => { void uploadFiles(Array.from(event.target.files ?? []).map((file) => ({ file, path: file.webkitRelativePath || file.name }))); event.target.value = ""; }} />}
        <button type="button" title={editing ? "完成编辑" : "编辑记录"} aria-label={editing ? "完成编辑" : "编辑记录"} onClick={() => setEditing(!editing)}>{editing ? <Check size={19} /> : <Pencil size={18} />}</button>
      </div>
    </header>

    <article className="dossier-detail-content">
      <div className="dossier-detail-breadcrumb"><Link href="/dossier">Dossier / 个人志</Link><span>/</span><span>{labels[kind]}</span></div>
      {editing ? <div className="dossier-detail-form">
        <label>{kind === "project" ? "项目名称" : kind === "skill" ? "技能名称" : kind === "experience" ? "机构或团队" : kind === "education" ? "学校" : kind === "node" ? "节点标题" : "荣誉名称"}<input value={title} onChange={(event) => update(kind === "skill" ? "name" : kind === "experience" ? "organization" : kind === "education" ? "school" : "title", event.target.value)} /></label>
        {kind === "skill" ? <><label>所属分类<select value={text(record, "group")} onChange={(event) => update("group", event.target.value)}>{["开发与技术", "硬件与工程", "研究与方法", "工具与表达", "其他"].map((group) => <option key={group}>{group}</option>)}</select></label><label>熟练度<select value={text(record, "level")} onChange={(event) => update("level", Number(event.target.value))}>{levelNames.map((name, index) => <option key={name} value={index}>{name}</option>)}</select></label></> : <label>{kind === "award" ? "获得时间" : "时间"}<input value={period} onChange={(event) => update(kind === "award" || kind === "node" ? "date" : "period", event.target.value)} /></label>}
        {kind === "project" || kind === "experience" ? <label>角色<input value={text(record, "role")} onChange={(event) => update("role", event.target.value)} /></label> : kind === "education" ? <label>专业与学位<input value={text(record, "program")} onChange={(event) => update("program", event.target.value)} /></label> : kind === "award" ? <label>颁发机构<input value={text(record, "organizer")} onChange={(event) => update("organizer", event.target.value)} /></label> : null}
        {kind === "project" && <><label>技术栈<input value={text(record, "stack")} onChange={(event) => update("stack", event.target.value)} placeholder="用逗号分隔" /></label><label>项目摘要<textarea value={text(record, "summary")} onChange={(event) => update("summary", event.target.value)} /></label><label>项目链接<input value={text(record, "url")} onChange={(event) => update("url", event.target.value)} placeholder="https://" /></label></>}
        {kind === "node" && <><label>分类<input value={text(record, "category")} onChange={(event) => update("category", event.target.value)} /></label><label>摘要<textarea value={text(record, "summary")} onChange={(event) => update("summary", event.target.value)} /></label></>}
        <label className="dossier-detail-wide">{kind === "skill" ? "实践与应用" : kind === "project" ? "项目详情" : "详细内容"}<textarea rows={10} value={longText} onChange={(event) => update(kind === "skill" ? "description" : "detail", event.target.value)} /></label>
      </div> : <>
        <div className="dossier-detail-heading"><span>{period}</span><h1>{title || "未命名记录"}</h1>{subtitle && <p>{subtitle}</p>}</div>
        {kind === "project" && (coverUrl || project?.cover) && <div className="dossier-detail-cover">
          <img src={coverUrl || project?.cover} alt={`${title || "项目"}封面`} />
        </div>}
        {kind === "project" && text(record, "stack") && <section className="dossier-detail-section"><h2>技术与工具</h2><div className="dossier-detail-tags">{text(record, "stack").split(/[,，]/).map((tag) => tag.trim()).filter(Boolean).map((tag) => <span key={tag}>{tag}</span>)}</div></section>}
        {kind === "skill" && <div className="dossier-detail-rating" aria-label={`熟练度：${subtitle}`}>{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < Number(text(record, "level")) ? "filled" : ""} />)}</div>}
        {(kind === "project" || kind === "node") && text(record, "summary") && <section className="dossier-detail-section"><h2>{kind === "project" ? "项目成果" : "摘要"}</h2><p>{text(record, "summary")}</p></section>}
        {longText && <section className="dossier-detail-section"><h2>{kind === "project" ? "项目详情" : kind === "skill" ? "实践与应用" : "详细内容"}</h2><p>{longText}</p></section>}
        {kind === "project" && project?.readme && !attachments.some((file) => file.path.toLowerCase() === "readme.md") && <section className="dossier-detail-section"><h2>项目说明</h2><ProjectMarkdown content={project.readme} files={allFiles} /></section>}
        {kind === "project" && readme?.blob && <section className="dossier-detail-section"><h2>项目说明</h2><Readme blob={readme.blob} files={allFiles} /></section>}
        {kind === "project" && images.length > 0 && <section className="dossier-detail-section"><h2>项目图片</h2><div className="dossier-detail-gallery">{images.map((file) => <button key={file.key || file.path} type="button" onClick={() => openPreview(file)} aria-label={`放大${file.path}`}>
          <img src={file.url} alt={file.path} /></button>)}</div></section>}
        {kind === "project" && safeUrl(text(record, "url")) && <a className="dossier-detail-external" href={safeUrl(text(record, "url"))} target="_blank" rel="noopener noreferrer">项目链接 <ExternalLink size={16} /></a>}
      </>}

      {kind === "project" && editing && <div className="dossier-detail-cover-action"><label htmlFor="dossier-project-cover"><ImagePlus size={16} />{coverUrl ? "更换项目封面" : "上传项目封面"}</label><input id="dossier-project-cover" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { void uploadCover(event.target.files?.[0]); event.target.value = ""; }} />{coverUrl && <button type="button" disabled={busy} onClick={() => void changeMedia(`project:${id}`).then(() => setMediaRevision((value) => value + 1)).catch(() => setError("封面删除失败。"))}><Trash2 size={15} />移除封面</button>}</div>}

      <section className={`dossier-detail-files ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node)) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); const fallback = Array.from(event.dataTransfer.files).map((file) => ({ file, path: file.name })); void droppedFiles(event.dataTransfer.items).then((files) => uploadFiles(files.length ? files : fallback)).catch(() => setError("无法读取拖入的文件夹。")); }}>
        <div className="dossier-detail-section-head"><h2>{kind === "project" ? "文件仓库" : "相关文件"}</h2><span>{allFiles.length} 个文件</span></div>
        {kind === "project" && <div className="dossier-detail-upload"><span>拖入文件或文件夹</span><div><button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}><Paperclip size={15} />添加文件</button><button type="button" onClick={() => folderInputRef.current?.click()} disabled={busy}><FolderUp size={15} />添加文件夹</button></div></div>}
        {allFiles.length > 0 && <div className="dossier-detail-file-list">{allFiles.slice().sort((a, b) => a.path.localeCompare(b.path)).map((file) => <div className="dossier-detail-file" key={file.key || file.path}>
          <FileText size={17} aria-hidden="true" /><button className="dossier-detail-file-name" type="button" onClick={() => openPreview(file)} title={file.path}>{file.path}</button><span className="dossier-detail-file-size">{(file.size / 1024).toFixed(0)} KB</span><a href={file.url} download={file.name} aria-label={`下载${file.path}`} title="下载"><Download size={16} /></a>{editing && file.key && <button type="button" disabled={busy} aria-label={`删除${file.path}`} title="删除" onClick={() => void removeAttachment(file.key!)}><Trash2 size={15} /></button>}
        </div>)}</div>}
      </section>
      {error && <p className="dossier-detail-error" role="alert">{error}</p>}
      {editing && !syncedProject && <div className="dossier-detail-danger"><button type="button" disabled={busy} onClick={() => void removeRecord()}><Trash2 size={15} />删除这条记录</button></div>}
    </article>
    {preview && <div className="dossier-detail-preview" role="dialog" aria-modal="true" aria-label={`预览${preview.path}`} onClick={() => setPreview(null)}><div className="dossier-detail-preview-panel" onClick={(event) => event.stopPropagation()}><header><span>{preview.path}</span><a href={preview.url} download={preview.name} title="下载" aria-label="下载"><Download size={18} /></a><button type="button" title="关闭" aria-label="关闭" onClick={() => setPreview(null)}><X size={19} /></button></header>{isImage(preview) ? <img src={preview.url} alt={preview.path} /> : /\.pdf$/i.test(preview.path) ? <iframe title={preview.path} src={preview.url} /> : isText(preview) ? /\.md$/i.test(preview.path) ? <ProjectMarkdown content={previewText} files={allFiles} /> : <pre>{previewText}</pre> : <p>此文件可下载查看。</p>}</div></div>}
  </main>;
}

function ProjectMarkdown({ content, files }: { content: string; files: Attachment[] }) {
  const resolve = (value?: string) => files.find((file) => file.path === value?.replace(/^\.\//, ""))?.url || value;
  return <div className="dossier-detail-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: ({ src, alt }) => <img src={resolve(typeof src === "string" ? src : undefined)} alt={alt || ""} />, a: ({ href, children }) => <a href={resolve(href)} target="_blank" rel="noopener noreferrer">{children}</a> }}>{content}</ReactMarkdown></div>;
}

function Readme({ blob, files }: { blob: Blob; files: Attachment[] }) {
  const [content, setContent] = useState("");
  useEffect(() => { let active = true; blob.text().then((value) => { if (active) setContent(value.slice(0, 500_000)); }); return () => { active = false; }; }, [blob]);
  return <ProjectMarkdown content={content} files={files} />;
}
