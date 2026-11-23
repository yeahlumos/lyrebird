import { readFile } from "node:fs/promises";
import path from "node:path";

const types: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".pdf": "application/pdf", ".md": "text/markdown; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; path: string[] }> }) {
  const { id, path: parts } = await params;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id) || !parts.length || parts.some((part) => !part || part === "." || part === ".." || /[\\/:\x00-\x1f]/.test(part))) {
    return new Response("Invalid file path", { status: 400 });
  }
  const root = path.resolve(process.cwd(), "public", "uploads", "projects", id);
  const target = path.resolve(root, ...parts);
  if (!target.startsWith(root + path.sep)) return new Response("Invalid file path", { status: 400 });
  try {
    const content = await readFile(target);
    const extension = path.extname(target).toLowerCase();
    const type = types[extension] ?? (/\.(txt|ts|tsx|js|jsx|mjs|css|html|svg|py|java|c|cpp|h|yml|yaml|xml|sh)$/i.test(target) ? "text/plain; charset=utf-8" : "application/octet-stream");
    return new Response(content, { headers: {
      "Content-Type": type,
      "Content-Length": String(content.length),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${type === "application/octet-stream" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(parts.at(-1)!)}`,
    } });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return new Response(code === "ENOENT" || code === "EISDIR" ? "File not found" : "Unable to read file", { status: code === "ENOENT" || code === "EISDIR" ? 404 : 500 });
  }
}
