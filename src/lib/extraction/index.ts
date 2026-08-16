/**
 * Orchestration de l'extraction de documents : détermine, selon le type du
 * fichier, la meilleure stratégie pour obtenir un contenu exploitable
 * (texte natif, image en vision, ou texte brut), puis délègue l'analyse au
 * provider IA actif (voir `src/lib/providers`).
 */

import { getProvider } from "@/lib/providers";
import type { ExtractionResult } from "@/lib/types";
import { extractPdfText, renderPdfFirstPageToPng } from "./pdf";

/**
 * Longueur minimale (en caractères) de texte natif extrait d'un PDF pour le
 * considérer exploitable. En dessous, le PDF est traité comme scanné et un
 * rendu image de sa première page est tenté à la place.
 */
const MIN_NATIVE_PDF_TEXT_LENGTH = 40;

/**
 * Extrait le contenu d'un document et en déduit nom/catégorie/résumé
 * suggérés via le provider IA actif.
 *
 * Stratégie selon le type MIME :
 * 1. `image/*` → envoi direct au provider (vision).
 * 2. `application/pdf` → tentative d'extraction du texte natif via
 *    "pdf-parse" ; si le texte est trop court (PDF probablement scanné),
 *    rendu de la première page en PNG et envoi de cette image au provider
 *    (vision) ; sinon, envoi du texte natif en `textHint`.
 * 3. `text/plain`, `text/markdown` → lecture directe du texte, appel
 *    provider en mode texte seul.
 * 4. Tout autre type → erreur claire.
 *
 * Résilient par construction : un échec du rendu PDF → image ne fait jamais
 * planter tout le flux, l'extraction retombe alors sur le texte partiel
 * disponible.
 */
export async function extractDocument(file: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<ExtractionResult> {
  const { buffer, mimeType, fileName } = file;
  const provider = await getProvider();

  if (mimeType.startsWith("image/")) {
    return provider.extractDocument({ buffer, mimeType, fileName });
  }

  if (mimeType === "application/pdf") {
    const nativeText = await extractPdfText(buffer);

    if (nativeText.length >= MIN_NATIVE_PDF_TEXT_LENGTH) {
      return provider.extractDocument({
        buffer,
        mimeType,
        fileName,
        textHint: nativeText,
      });
    }

    // Texte natif insuffisant : probablement un PDF scanné. On tente un
    // rendu de la première page en image pour une analyse en vision.
    const pageImage = await renderPdfFirstPageToPng(buffer);

    if (pageImage) {
      return provider.extractDocument({
        buffer: pageImage,
        mimeType: "image/png",
        fileName,
      });
    }

    // Le rendu a échoué : on retombe sur le texte partiel disponible
    // (éventuellement vide) plutôt que de faire planter la requête.
    return provider.extractDocument({
      buffer,
      mimeType,
      fileName,
      textHint: nativeText,
    });
  }

  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    const text = buffer.toString("utf-8").trim();
    return provider.extractDocument({
      buffer,
      mimeType,
      fileName,
      textHint: text,
    });
  }

  throw new Error(`Type de fichier non supporté : ${mimeType}`);
}
