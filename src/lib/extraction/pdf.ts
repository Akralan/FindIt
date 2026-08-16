/**
 * Aides bas niveau pour l'extraction de contenu PDF :
 * - extraction du texte natif via "pdf-parse" ;
 * - rendu de la première page en PNG via "pdfjs-dist" (build "legacy",
 *   compatible Node sans DOM) + "@napi-rs/canvas", utilisé en secours pour
 *   les PDF scannés (sans couche texte exploitable).
 *
 * Ce module ne doit jamais faire planter l'appelant : toute erreur de
 * bibliothèque (PDF corrompu, protégé, police manquante, etc.) est capturée
 * et convertie en valeur de repli (chaîne vide / `null`).
 */

import pdfParse from "pdf-parse";
import { createCanvas } from "@napi-rs/canvas";

/**
 * Extrait le texte natif d'un PDF. Ne lève jamais : retourne une chaîne
 * vide si l'extraction échoue.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const result = await pdfParse(buffer);
    return (result.text ?? "").trim();
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Rendu de la 1ère page en PNG (fallback PDF scanné)
// ---------------------------------------------------------------------------

/** Sous-ensemble minimal de l'API pdfjs-dist réellement utilisé ici. */
interface PdfjsViewport {
  width: number;
  height: number;
}

interface PdfjsRenderTask {
  promise: Promise<void>;
}

interface PdfjsPage {
  getViewport(params: { scale: number }): PdfjsViewport;
  render(params: { canvasContext: unknown; viewport: PdfjsViewport }): PdfjsRenderTask;
}

interface PdfjsDocument {
  getPage(pageNumber: number): Promise<PdfjsPage>;
  destroy(): Promise<void>;
}

interface PdfjsLoadingTask {
  promise: Promise<PdfjsDocument>;
}

interface PdfjsModule {
  getDocument(params: {
    data: Uint8Array;
    useSystemFonts?: boolean;
    isEvalSupported?: boolean;
  }): PdfjsLoadingTask;
}

/**
 * Charge dynamiquement le build "legacy" de pdfjs-dist (compatible Node,
 * sans DOM). Le chemin du module est passé via une variable plutôt qu'un
 * littéral : TypeScript n'essaie alors pas de résoudre les déclarations de
 * types de ce sous-module (dont la forme exacte varie selon les versions),
 * ce qui isole ce fichier des détails d'implémentation de la dépendance.
 * L'import dynamique est nécessaire car "pdf.mjs" est un module ESM, non
 * "require"-able depuis du code CommonJS.
 */
async function loadPdfjs(): Promise<PdfjsModule> {
  const specifier = "pdfjs-dist/legacy/build/pdf.mjs";
  const mod = await import(specifier);
  return mod as unknown as PdfjsModule;
}

/**
 * Rend la première page d'un PDF en PNG — utilisé pour les PDF scannés sans
 * texte exploitable, afin de fournir une image au provider IA (vision).
 *
 * Ne lève JAMAIS : toute erreur (page absente, échec de rendu, police
 * manquante, environnement sans support natif, etc.) est capturée et fait
 * retourner `null`, pour que l'appelant retombe sur le texte partiel déjà
 * extrait plutôt que de faire planter tout le flux d'extraction.
 */
export async function renderPdfFirstPageToPng(buffer: Buffer): Promise<Buffer | null> {
  try {
    const pdfjsLib = await loadPdfjs();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      isEvalSupported: false,
    });
    const pdfDocument = await loadingTask.promise;

    try {
      const page = await pdfDocument.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      const width = Math.max(1, Math.ceil(viewport.width));
      const height = Math.max(1, Math.ceil(viewport.height));

      const canvas = createCanvas(width, height);
      const context = canvas.getContext("2d");

      const renderTask = page.render({ canvasContext: context, viewport });
      await renderTask.promise;

      return canvas.toBuffer("image/png");
    } finally {
      await pdfDocument.destroy();
    }
  } catch {
    return null;
  }
}
