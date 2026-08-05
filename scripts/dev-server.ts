/**
 * 本地静态服务器:发布前本地双窗口 E2E 用。
 * 启动: bun run dev  → http://localhost:8080/
 */

import { readFile } from "node:fs/promises";
import { join, normalize, resolve } from "node:path";

const PORT = Number(process.env.PORT ?? 8080);
const ROOT = resolve(import.meta.dir, "..", "www");

const MIME: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".glb": "model/gltf-binary",
    ".hdr": "image/vnd.radiance",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".wasm": "application/wasm",
};

Bun.serve({
    port: PORT,
    async fetch(request) {
        const url = new URL(request.url);
        let path = normalize(decodeURIComponent(url.pathname));
        if (path.endsWith("/")) {
            path += "index.html";
        }
        const filePath = join(ROOT, path);
        if (!filePath.startsWith(ROOT)) {
            return new Response("Forbidden", { status: 403 });
        }
        try {
            const body = await readFile(filePath);
            const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
            return new Response(body, { headers: { "Content-Type": MIME[ext] ?? "application/octet-stream" } });
        } catch {
            return new Response("Not found", { status: 404 });
        }
    },
});

console.log(`[dev-server] serving ${ROOT} at http://localhost:${PORT}/`);
