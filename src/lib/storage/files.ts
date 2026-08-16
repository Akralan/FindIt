/**
 * Stockage des fichiers physiques sur disque, sous DATA_DIR/files/<catégorie>
 * et DATA_DIR/trash/ pour les fichiers supprimés. Aucune dépendance externe :
 * uniquement le module "fs/promises" natif de Node.
 */

import { promises as fs } from "fs";
import path from "path";

/**
 * Résout le répertoire racine de données de l'application. Lit
 * process.env.DATA_DIR (défaut "./data"), résolu en chemin absolu par
 * rapport au répertoire de travail du process.
 */
export function resolveDataDir(): string {
  return path.resolve(process.cwd(), process.env.DATA_DIR ?? "./data");
}

function filesRootDir(): string {
  return path.join(resolveDataDir(), "files");
}

function trashRootDir(): string {
  return path.join(resolveDataDir(), "trash");
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/** Normalise les séparateurs de chemin en "/" pour un stockage portable. */
function toPosixPath(relPath: string): string {
  return relPath.split(path.sep).join("/");
}

/**
 * Trouve un nom de fichier disponible dans `dir` à partir de `fileName`, en
 * ajoutant un suffixe "-2", "-3", ... avant l'extension en cas de collision
 * avec un fichier déjà présent.
 */
async function dedupeFileName(dir: string, fileName: string): Promise<string> {
  const ext = path.extname(fileName);
  const base = fileName.slice(0, fileName.length - ext.length);
  let candidate = fileName;
  let counter = 2;
  while (await pathExists(path.join(dir, candidate))) {
    candidate = `${base}-${counter}${ext}`;
    counter += 1;
  }
  return candidate;
}

/**
 * Écrit `buffer` sous DATA_DIR/files/<category>/<fileName>, en créant les
 * dossiers manquants et en dé-dupliquant le nom en cas de collision.
 * Retourne le chemin relatif à DATA_DIR/files (ex: "Factures/edf-2026-03.pdf"),
 * à stocker tel quel dans `DocumentRecord.filePath`.
 */
export async function saveFile(
  buffer: Buffer,
  category: string,
  fileName: string
): Promise<string> {
  const dir = path.join(filesRootDir(), category);
  await ensureDir(dir);
  const finalName = await dedupeFileName(dir, fileName);
  await fs.writeFile(path.join(dir, finalName), buffer);
  return toPosixPath(path.join(category, finalName));
}

/**
 * Déplace un fichier déjà stocké (chemin relatif à DATA_DIR/files) vers une
 * nouvelle catégorie/nom, en créant les dossiers manquants et en
 * dé-dupliquant le nom si besoin. Retourne le nouveau chemin relatif.
 */
export async function moveFile(
  oldRelPath: string,
  newCategory: string,
  newFileName: string
): Promise<string> {
  const oldAbsPath = path.join(filesRootDir(), oldRelPath);
  const newDir = path.join(filesRootDir(), newCategory);
  await ensureDir(newDir);

  const desiredAbsPath = path.join(newDir, newFileName);
  const isNoop = path.resolve(oldAbsPath) === path.resolve(desiredAbsPath);

  const finalName = isNoop
    ? newFileName
    : await dedupeFileName(newDir, newFileName);
  const newAbsPath = path.join(newDir, finalName);

  if (path.resolve(oldAbsPath) !== path.resolve(newAbsPath)) {
    await fs.rename(oldAbsPath, newAbsPath);
  }

  return toPosixPath(path.join(newCategory, finalName));
}

/**
 * Déplace un fichier vers DATA_DIR/trash/ plutôt que de le supprimer
 * définitivement, en conservant sa structure de sous-dossiers et en
 * dé-dupliquant le nom en cas de collision dans la corbeille.
 */
export async function deleteFileToTrash(relPath: string): Promise<void> {
  const absPath = path.join(filesRootDir(), relPath);
  const destDir = path.join(trashRootDir(), path.dirname(relPath));
  await ensureDir(destDir);
  const fileName = path.basename(relPath);
  const finalName = await dedupeFileName(destDir, fileName);
  await fs.rename(absPath, path.join(destDir, finalName));
}

/** Lit le contenu d'un fichier stocké (chemin relatif à DATA_DIR/files). */
export async function readFile(relPath: string): Promise<Buffer> {
  return fs.readFile(path.join(filesRootDir(), relPath));
}
