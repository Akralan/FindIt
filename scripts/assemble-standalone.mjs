#!/usr/bin/env node
/**
 * En mode `output: "standalone"`, Next.js ne copie PAS public/ ni
 * .next/static dans .next/standalone (seul le code serveur tracé y est
 * mis) : ce script fait ce dernier pas, requis avant de packager avec
 * Electron. À lancer après "next build".
 *
 * Voir https://nextjs.org/docs/app/api-reference/config/next-config-js/output
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const STANDALONE_DIR = path.join(ROOT, ".next", "standalone");

if (!existsSync(STANDALONE_DIR)) {
  console.error(
    '.next/standalone introuvable — lancer "npm run build" avant ce script.',
  );
  process.exit(1);
}

const copies = [
  [path.join(ROOT, "public"), path.join(STANDALONE_DIR, "public")],
  [
    path.join(ROOT, ".next", "static"),
    path.join(STANDALONE_DIR, ".next", "static"),
  ],
];

for (const [from, to] of copies) {
  if (!existsSync(from)) {
    console.warn(`Ignoré (absent) : ${from}`);
    continue;
  }
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log(`Copié : ${from} -> ${to}`);
}

// node-llama-cpp liste TOUS ses binaires plateforme (win-arm64, cuda,
// cuda-ext, vulkan...) en optionalDependencies : le traceur de fichiers
// de Next ne peut pas deviner lequel sera réellement chargé au runtime
// et les embarque donc tous — un cadeau de ~650 Mo pour une cible qui
// n'est QUE win-x64 CPU. On tranche ici : ne garder que win-x64.
const nodeLlamaCppScope = path.join(
  STANDALONE_DIR,
  "node_modules",
  "@node-llama-cpp",
);
const KEEP_PLATFORM = "win-x64";
if (existsSync(nodeLlamaCppScope)) {
  for (const entry of readdirSync(nodeLlamaCppScope)) {
    if (entry !== KEEP_PLATFORM) {
      rmSync(path.join(nodeLlamaCppScope, entry), {
        recursive: true,
        force: true,
      });
      console.log(`Élagué (plateforme non ciblée) : @node-llama-cpp/${entry}`);
    }
  }
}

// Filet de sécurité : "electron"/"electron-builder" ne doivent jamais
// finir dans le bundle serveur (voir outputFileTracingExcludes côté
// next.config.mjs) — s'ils sont là malgré tout, on les retire ici.
for (const pkg of ["electron", "electron-builder"]) {
  const pkgDir = path.join(STANDALONE_DIR, "node_modules", pkg);
  if (existsSync(pkgDir)) {
    rmSync(pkgDir, { recursive: true, force: true });
    console.log(`Élagué (ne doit pas être dans le bundle serveur) : ${pkg}`);
  }
}

console.log("Build standalone assemblé.");
