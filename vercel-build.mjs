/**
 * Vercel build orchestrator — no direct esbuild import needed here.
 * All heavy lifting is delegated to pnpm package scripts.
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdir } from "node:fs/promises";

const root = path.dirname(fileURLToPath(import.meta.url));
const run = (cmd) => execSync(cmd, { stdio: "inherit", cwd: root });

// 1. Ensure api/ output dir exists
await mkdir(path.join(root, "api"), { recursive: true });

// 2. Build the React/Vite frontend
console.log("\n▶  Building frontend…");
run("PORT=3000 BASE_PATH=/ pnpm --filter @workspace/zombie-shooter run build");
console.log("✓  Frontend ready\n");

// 3. Bundle the Express API (uses esbuild inside api-server's own node_modules)
console.log("▶  Bundling API for Vercel…");
run("pnpm --filter @workspace/api-server run build:vercel");
console.log("✓  API bundled to api/index.js\n");

console.log("✅ Vercel build complete!");
