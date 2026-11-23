import { timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Project, ProjectFile, ProjectShowcase } from "@/app/dossier/types";

const dataFile = path.join(process.cwd(), "data", "projects.json");
const uploadsRoot = path.join(process.cwd(), "public", "uploads", "projects");
const maxBytes = 100 * 1024 * 1024;
const maxFiles = 1000;

async function readProjects(): Promise<Project[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(dataFile, "utf8"));
    return Array.isArray(parsed) ? parsed.filter((item): item is Project => Boolean(item && typeof item.id === "string" && typeof item.title === "string")) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function authorized(value: string | null) {
  const supplied = Buffer.from(value ?? "");
  const expected = Buffer.from(process.env.LYREBIRD_SYNC_KEY || "lyrebird-dev-key");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function safePath(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > 300) return null;
  const parts = value.replaceAll("\\", "/").split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part))) return null;
  return parts.join("/");
}

function cleanString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function mimeType(file: File, name: string) {
  if (file.type) return file.type;
  const extension = path.extname(name).toLowerCase();
  return ({ ".md": "text/markdown", ".txt": "text/plain", ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".json": "application/json", ".ts": "text/plain", ".tsx": "text/plain", ".js": "text/plain", ".jsx": "text/plain", ".css": "text/css", ".html": "text/html" } as Record<string, string>)[extension] ?? "application/octet-stream";
}

export async function GET() {
  try {
    return Response.json(await readProjects(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "项目数据读取失败。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authorized(request.headers.get("x-lyrebird-key"))) return Response.json({ error: "密钥无效。" }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes + 1024 * 1024) return Response.json({ error: "上传内容过大。" }, { status: 413 });

  try {
    const form = await request.formData();
    const raw = form.get("manifest");
    if (typeof raw !== "string") return Response.json({ error: "缺少 manifest。" }, { status: 400 });
    let manifest: unknown;
    try { manifest = JSON.parse(raw); }
    catch { return Response.json({ error: "manifest 必须是有效 JSON。" }, { status: 400 }); }
    if (!manifest || typeof manifest !== "object") return Response.json({ error: "manifest 格式错误。" }, { status: 400 });
    const { project, paths } = manifest as { project?: Record<string, unknown>; paths?: unknown };
    const files = form.getAll("files");
    if (!project || !Array.isArray(paths) || files.length !== paths.length || files.length > maxFiles || files.some((file) => !(file instanceof File))) return Response.json({ error: "文件清单无效。" }, { status: 400 });
    const id = cleanString(project.id);
    const title = cleanString(project.title);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id) || !title || title.length > 180) return Response.json({ error: "项目 ID 或标题无效。" }, { status: 400 });
    const filePaths = paths.map(safePath);
    if (filePaths.some((value) => !value) || new Set(filePaths).size !== filePaths.length) return Response.json({ error: "文件路径无效或重复。" }, { status: 400 });
    const fileItems = files as File[];
    if (fileItems.reduce((sum, file) => sum + file.size, 0) > maxBytes) return Response.json({ error: "文件总大小不能超过 100 MB。" }, { status: 413 });

    const existing = await readProjects();
    const previous = existing.find((item) => item.id === id);
    const projectRoot = path.join(uploadsRoot, id);
    const uploaded: ProjectFile[] = [];
    let readme = previous?.readme ?? "";
    let readmePath = previous?.readmePath ?? (readme ? "README.md" : "");
    const uploadedReadmePath = filePaths.filter((value): value is string => Boolean(value && /(^|\/)readme\.md$/i.test(value)))
      .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))[0];
    for (let index = 0; index < fileItems.length; index++) {
      const relative = filePaths[index]!;
      const absolute = path.resolve(projectRoot, ...relative.split("/"));
      if (!absolute.startsWith(projectRoot + path.sep)) return Response.json({ error: "文件路径越界。" }, { status: 400 });
      const file = fileItems[index];
      const bytes = Buffer.from(await file.arrayBuffer());
      await mkdir(path.dirname(absolute), { recursive: true });
      await writeFile(absolute, bytes);
      const url = `/api/projects/files/${encodeURIComponent(id)}/${relative.split("/").map(encodeURIComponent).join("/")}`;
      uploaded.push({ path: relative, url, type: mimeType(file, relative), size: file.size });
      if (relative === uploadedReadmePath) {
        readme = bytes.toString("utf8").slice(0, 1024 * 1024);
        readmePath = relative;
      }
    }

    const stack = Array.isArray(project.stack) ? project.stack.filter((item): item is string => typeof item === "string").join(", ") : cleanString(project.stack, previous?.stack);
    const highlights = Array.isArray(project.highlights) ? project.highlights.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).join("\n") : "";
    const mergedFiles = new Map((previous?.files ?? []).map((file) => [file.path, file]));
    uploaded.forEach((file) => mergedFiles.set(file.path, file));
    const allFiles = [...mergedFiles.values()].sort((a, b) => a.path.localeCompare(b.path));
    const preferredCover = safePath(project.cover);
    const cover = (preferredCover && allFiles.find((file) => file.path === preferredCover)?.url) || previous?.cover || allFiles.find((file) => file.type.startsWith("image/"))?.url || "";
    const incomingShowcase = project.showcase;
    let showcase = previous?.showcase;
    if (incomingShowcase && typeof incomingShowcase === "object" && !Array.isArray(incomingShowcase)) {
      const source = incomingShowcase as Record<string, unknown>;
      const imagePath = (value: unknown) => {
        const relative = safePath(value);
        return relative && allFiles.some((file) => file.path === relative && /\.(png|jpe?g|webp)$/i.test(file.path)) ? relative : undefined;
      };
      showcase = {
        highlights: Array.isArray(source.highlights) ? source.highlights.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 12) : [],
        gallery: Array.isArray(source.gallery) ? source.gallery.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const relative = imagePath(item.path);
          return relative ? [{ path: relative, caption: cleanString(item.caption) }] : [];
        }).slice(0, 40) : [],
        sections: Array.isArray(source.sections) ? source.sections.flatMap((item) => {
          if (!item || typeof item !== "object" || !cleanString(item.title)) return [];
          return [{ title: cleanString(item.title), body: cleanString(item.body), image: imagePath(item.image) }];
        }).slice(0, 30) : [],
      } satisfies ProjectShowcase;
    }
    const next: Project = {
      id,
      title,
      period: cleanString(project.period, previous?.period),
      role: cleanString(project.role, previous?.role),
      stack,
      summary: cleanString(project.summary ?? project.tagline, previous?.summary),
      detail: cleanString(project.detail, highlights || previous?.detail),
      url: cleanString(project.url, previous?.url),
      files: allFiles,
      readme,
      readmePath,
      cover,
      showcase,
    };
    const projects = existing.some((item) => item.id === id) ? existing.map((item) => item.id === id ? next : item) : [...existing, next];
    await mkdir(path.dirname(dataFile), { recursive: true });
    const temporary = `${dataFile}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(projects, null, 2), "utf8");
    await rename(temporary, dataFile);
    return Response.json({ id, files: uploaded.length, url: `/dossier/project/${encodeURIComponent(id)}` });
  } catch {
    return Response.json({ error: "项目同步失败，请检查文件和本地存储权限。" }, { status: 500 });
  }
}
