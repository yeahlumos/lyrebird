import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set(["node_modules", ".git", ".next", "dist", "build", "coverage", ".venv"]);
const ignoredFile = (name) => name.startsWith(".env") || /\.(pem|key)$/i.test(name) || name === ".DS_Store";

async function listFiles(directory, relative = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const next = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) result.push(...await listFiles(path.join(directory, entry.name), next));
    } else if (entry.isFile() && !ignoredFile(entry.name)) {
      result.push(next.split(path.sep).join("/"));
    }
  }
  return result;
}

function contentType(filename) {
  const extension = path.extname(filename).toLowerCase();
  return ({ ".md": "text/markdown", ".txt": "text/plain", ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".json": "application/json", ".ts": "text/plain", ".tsx": "text/plain", ".js": "text/plain", ".jsx": "text/plain", ".css": "text/css", ".html": "text/html" })[extension] || "application/octet-stream";
}

try {
  const metadata = JSON.parse(await readFile(path.join(root, "lyrebird.json"), "utf8"));
  const id = metadata.id || path.basename(root).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!id || !metadata.title) throw new Error("lyrebird.json 需要 title；项目目录名无法生成 ID 时还需要 id。");
  const paths = (await listFiles(root)).sort();
  if (!paths.some((name) => name.toLowerCase() === "readme.md")) throw new Error("项目根目录缺少 README.md。");
  const manifest = { project: { ...metadata, id }, paths };
  const form = new FormData();
  form.set("manifest", JSON.stringify(manifest));
  for (const relative of paths) {
    const bytes = await readFile(path.join(root, ...relative.split("/")));
    form.append("files", new File([bytes], path.basename(relative), { type: contentType(relative) }));
  }
  const endpoint = new URL("/api/projects/sync", process.env.LYREBIRD_URL || "http://localhost:3000");
  const response = await fetch(endpoint, { method: "POST", headers: { "x-lyrebird-key": process.env.LYREBIRD_SYNC_KEY || "lyrebird-dev-key" }, body: form });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `同步失败：HTTP ${response.status}`);
  console.log(`已推送 ${metadata.title}，${result.files} 个文件：${new URL(result.url, endpoint).href}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
