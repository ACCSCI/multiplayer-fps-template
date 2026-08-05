/**
 * 单文件行数检查:所有自有源码文件不得超过 600 行。
 * 排除 vendored 第三方与数据资产(threejs、resources)。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const MAX_LINES = 600;
const SCAN_DIRS = ["www", "scripts"];
const EXCLUDE_DIRS = new Set(["threejs", "resources", "node_modules", ".git", "coverage", "build"]);
const EXCLUDE_FILES = new Set(["package-lock.json", "bun.lock", "bun.lockb"]);

function walk(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (EXCLUDE_DIRS.has(entry.name)) {
                continue;
            }
            files.push(...walk(join(dir, entry.name)));
        } else if (entry.isFile()) {
            files.push(join(dir, entry.name));
        }
    }
    return files;
}

function isSourceFile(path: string): boolean {
    if (EXCLUDE_FILES.has(path.split(sep).pop() ?? "")) {
        return false;
    }
    return /\.(js|ts|mjs|jsx|tsx)$/.test(path);
}

const violations: Array<{ file: string; lines: number }> = [];
for (const dir of SCAN_DIRS) {
    for (const file of walk(join(ROOT, dir))) {
        if (!isSourceFile(file)) {
            continue;
        }
        const text = readFileSync(file, "utf8");
        const lines = text === "" ? 0 : text.split("\n").length;
        if (lines > MAX_LINES) {
            violations.push({ file: file.slice(ROOT.length + 1), lines });
        }
    }
}

if (violations.length > 0) {
    console.error(`[check-lines] ${violations.length} file(s) exceed ${MAX_LINES} lines:`);
    for (const v of violations) {
        console.error(`  ${v.file}: ${v.lines} lines`);
    }
    process.exit(1);
}
console.log("[check-lines] OK: all source files within limit");
