/**
 * Ouverture du port de synchro dans le pare-feu Windows, en un clic pour
 * l'utilisateur — pas question de lui demander d'ouvrir PowerShell en
 * administrateur lui-même (voir SYNC_CONTRACTS.md pour le contexte du
 * protocole ; ce module est spécifique à Windows, hors contrat mobile).
 *
 * Mécanisme : le process Next.js tourne avec les droits normaux de
 * l'utilisateur (jamais admin). Modifier une règle de pare-feu exige des
 * droits admin. On ne fait donc jamais ça silencieusement : on lance un
 * sous-process PowerShell élevé via `Start-Process -Verb RunAs`, qui
 * déclenche le popup UAC natif de Windows ("Voulez-vous autoriser cette
 * application...") — l'utilisateur voit exactement ce qui va se passer et
 * clique lui-même Oui/Non. On ne peut pas soi-même cliquer ce popup ni le
 * contourner, et on ne doit pas essayer.
 */

import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { randomUUID } from "crypto";

export const FIREWALL_RULE_NAME = "FindIt webapp (LAN, synchro mobile)";

function buildRuleScript(port: number): string {
  // Supprime une éventuelle règle existante avant de recréer : idempotent,
  // évite une erreur si l'utilisateur clique le bouton plusieurs fois ou
  // si le port a changé entre deux appels.
  //
  // Tous les profils (Domain/Private/Public), pas seulement Privé : l'
  // interface virtuelle créée par le point d'accès mobile
  // (src/lib/sync/hotspot.ts, mode hotspot de SYNC_CONTRACTS.md §1bis)
  // n'est pas garantie d'être classée "Privé" par Windows. Plutôt que de
  // traquer précisément la catégorie de chaque interface, on élargit cette
  // règle — acceptable car elle ne couvre qu'un seul port dédié à la
  // synchro.
  return [
    "$ErrorActionPreference = 'Stop'",
    `$ruleName = '${FIREWALL_RULE_NAME.replace(/'/g, "''")}'`,
    "Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue",
    `New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort ${port} -Action Allow -Profile Domain,Private,Public | Out-Null`,
  ].join("\r\n");
}

/**
 * Vérifie si la règle existe déjà. Lire les règles de pare-feu ne demande
 * PAS de droits admin (contrairement à en créer/supprimer) — pas besoin
 * d'élévation pour ce contrôle.
 */
export function firewallRuleExists(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("powershell.exe", [
      "-NoProfile",
      "-Command",
      `if (Get-NetFirewallRule -DisplayName '${FIREWALL_RULE_NAME.replace(/'/g, "''")}' -ErrorAction SilentlyContinue) { Write-Output 'yes' } else { Write-Output 'no' }`,
    ]);
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", () => resolve(false));
    child.on("close", () => resolve(output.trim().includes("yes")));
  });
}

/**
 * Déclenche le popup d'élévation Windows pour créer la règle de pare-feu
 * autorisant `port` en entrée, sur tous les profils réseau (Domain/Private/
 * Public — voir `buildRuleScript` pour la justification). Retourne une fois
 * le sous-process élevé terminé (accepté et exécuté, ou refusé/fermé par
 * l'utilisateur) — le résultat réel doit être vérifié séparément via
 * `firewallRuleExists()`, car un refus du popup UAC ne remonte pas toujours
 * comme une erreur exploitable ici.
 */
export async function requestFirewallRuleElevated(port: number): Promise<void> {
  if (process.platform !== "win32") {
    throw new Error("Cette action n'est disponible que sur Windows.");
  }

  const scriptPath = path.join(os.tmpdir(), `findit-firewall-${randomUUID()}.ps1`);
  await fs.writeFile(scriptPath, buildRuleScript(port), "utf-8");

  try {
    await new Promise<void>((resolve, reject) => {
      const outer = spawn("powershell.exe", [
        "-NoProfile",
        "-Command",
        `Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${scriptPath.replace(/'/g, "''")}'`,
      ]);
      outer.on("error", reject);
      outer.on("close", () => resolve());
    });
  } finally {
    await fs.unlink(scriptPath).catch(() => {});
  }
}
