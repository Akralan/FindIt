/**
 * Vérification d'authentification factorisée pour toutes les routes sous
 * `src/app/api/sync/*` (voir SYNC_CONTRACTS.md, section 1). Ces routes sont
 * les seules de l'application à exiger un header `Authorization: Bearer
 * <token>` — le reste de l'API continue de fonctionner sans auth (usage
 * local mono-utilisateur inchangé).
 */

import { NextResponse } from "next/server";
import { isValidSyncToken } from "./token";

const BEARER_PREFIX = "Bearer ";

function extractBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header || !header.startsWith(BEARER_PREFIX)) return null;
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Vérifie le header `Authorization` de `req` contre le jeton de synchro
 * courant. Retourne une `NextResponse` 401 à renvoyer immédiatement si
 * l'authentification échoue, ou `null` si elle réussit (la route peut
 * continuer son traitement).
 *
 * Usage dans une route :
 * ```ts
 * const authError = await requireSyncAuth(req);
 * if (authError) return authError;
 * ```
 */
export async function requireSyncAuth(req: Request): Promise<NextResponse | null> {
  const token = extractBearerToken(req);
  const valid = await isValidSyncToken(token);
  if (!valid) {
    return NextResponse.json(
      { error: "Authentification requise : header Authorization: Bearer <token> absent ou invalide." },
      { status: 401 }
    );
  }
  return null;
}
