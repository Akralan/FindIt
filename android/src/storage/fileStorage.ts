/**
 * Fichiers locaux : téléchargement depuis le PC et ouverture via l'intent
 * système Android. `expo-file-system/legacy` (API promesses `documentDirectory`
 * / `downloadAsync` / `getContentUriAsync`) plutôt que la nouvelle API
 * `File`/`Directory` — plus directe pour ce qu'il nous faut ici (voir
 * ARCHITECTURE.md).
 */

import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { Platform } from "react-native";

import * as Sharing from "expo-sharing";

const DOCUMENTS_DIR = `${FileSystem.documentDirectory}findit-documents/`;

async function ensureDocumentsDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DOCUMENTS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DOCUMENTS_DIR, { intermediates: true });
  }
}

/** Extension de fichier déduite du nom courant, ou à défaut du type MIME. */
function guessExtension(currentName: string, mimeType: string): string {
  const dotIndex = currentName.lastIndexOf(".");
  if (dotIndex > 0 && dotIndex < currentName.length - 1) {
    return currentName.slice(dotIndex);
  }
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType.startsWith("image/")) return `.${mimeType.split("/")[1]}`;
  return "";
}

/** Chemin local (avant téléchargement) pour un document donné. */
export function localPathForDocument(id: string, currentName: string, mimeType: string): string {
  return `${DOCUMENTS_DIR}${id}${guessExtension(currentName, mimeType)}`;
}

/**
 * Télécharge le fichier d'un document depuis le PC pairé vers le stockage
 * local de l'app, avec le header d'auth requis par `/api/sync/*`
 * (SYNC_CONTRACTS.md §1). Renvoie l'URI locale `file://...`.
 */
export async function downloadDocumentFile(
  url: string,
  token: string,
  destinationPath: string,
): Promise<string> {
  await ensureDocumentsDir();
  const result = await FileSystem.downloadAsync(url, destinationPath, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Échec du téléchargement (HTTP ${result.status}).`);
  }
  return result.uri;
}

export async function deleteLocalFile(localFilePath: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(localFilePath);
  if (info.exists) {
    await FileSystem.deleteAsync(localFilePath, { idempotent: true });
  }
}

export async function localFileExists(localFilePath: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(localFilePath);
  return info.exists;
}

/**
 * Ouvre un fichier local avec l'application système appropriée (visionneuse
 * PDF, etc.) plutôt que d'embarquer un rendu custom — voir ROADMAP.md.
 * Sur Android : intent `ACTION_VIEW` avec une URI de contenu FileProvider
 * (obligatoire depuis Android 7 — une URI `file://` brute lève
 * `FileUriExposedException`). Si l'intent échoue (aucune app compatible,
 * etc.), on retombe sur la feuille de partage système comme filet de
 * sécurité.
 */
export async function openFileExternally(localFilePath: string, mimeType: string): Promise<void> {
  if (Platform.OS === "android") {
    try {
      const contentUri = await FileSystem.getContentUriAsync(localFilePath);
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: mimeType,
      });
      return;
    } catch {
      // Filet de sécurité : partage système (permet aussi "Ouvrir avec…").
    }
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Aucune application disponible pour ouvrir ce fichier.");
  }
  await Sharing.shareAsync(localFilePath, { mimeType });
}
