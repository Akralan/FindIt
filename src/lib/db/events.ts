/**
 * Journal d'événements sur les documents (création, renommage, déplacement,
 * édition, suppression), utilisé notamment pour l'undo.
 */

import { v4 as uuidv4 } from "uuid";
import type { DocumentEvent } from "@/lib/types";
import { readDb, writeDb } from "./store";

/** Enregistre un nouvel événement et le retourne (id + createdAt générés). */
export async function logEvent(
  e: Omit<DocumentEvent, "id" | "createdAt">
): Promise<DocumentEvent> {
  const db = await readDb();
  const event: DocumentEvent = {
    ...e,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
  };
  db.events.push(event);
  await writeDb(db);
  return event;
}

/**
 * Retourne le dernier événement enregistré pour ce document (le plus
 * récent selon `createdAt`), ou null s'il n'y en a aucun.
 */
export async function getLastEvent(
  documentId: string
): Promise<DocumentEvent | null> {
  const db = await readDb();
  const eventsForDoc = db.events.filter((ev) => ev.documentId === documentId);
  if (eventsForDoc.length === 0) {
    return null;
  }
  return eventsForDoc.reduce((latest, current) =>
    current.createdAt > latest.createdAt ? current : latest
  );
}

/** Supprime un événement (utilisé après qu'un undo l'a consommé). */
export async function deleteEvent(id: string): Promise<void> {
  const db = await readDb();
  db.events = db.events.filter((ev) => ev.id !== id);
  await writeDb(db);
}
