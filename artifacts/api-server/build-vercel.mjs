/**
 * Bundles src/app.ts (Express app export — no listen()) into
 * ../../api/index.js as a single CJS file for Vercel serverless.
 * Pino is externalized (Vercel doesn't use the pino worker transport).
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(artifactDir, "../..");
const outFile = path.join(repoRoot, "api/index.js");

await esbuild({
  entryPoints: [path.join(artifactDir, "src/app.ts")],
  platform: "node",
  target: "node20",
  bundle: true,
  format: "cjs",
  outfile: outFile,
  logLevel: "info",
  // Surface the Express app as module.exports so Vercel uses it as a request handler.
  footer: {
    js: "if (module.exports && module.exports.default) { module.exports = module.exports.default; }",
  },
  external: [
    // Pino: externalized — Vercel uses its own logging infra; we'll fall back to console
    "pino",
    "pino-http",
    "pino-pretty",
    "thread-stream",
    // Native / optional
    "*.node",
    "pg-native",
    "sharp",
    "canvas",
    "bcrypt",
    "argon2",
    "fsevents",
    "re2",
    "bufferutil",
    "utf-8-validate",
    "ssh2",
    "cpu-features",
    "dtrace-provider",
    "lightningcss",
    "better-sqlite3",
    "sqlite3",
    "oracledb",
    "mysql2",
    "snappy",
    "@prisma/client",
    "@aws-sdk/*",
    "@azure/*",
    "@opentelemetry/*",
    "@google-cloud/*",
    "firebase-admin",
    "dd-trace",
    "newrelic",
  ],
});

console.log(`  → ${outFile}`);
