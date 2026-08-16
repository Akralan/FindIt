/**
 * Orchestration du Point d'accès mobile Windows (Mobile Hotspot), utilisé
 * comme repli de synchro quand le wifi partagé (routeur du domicile) bloque
 * les connexions entre appareils (isolation AP — voir la discussion du
 * 17 août 2026 dans l'historique du projet). Le PC devient son propre point
 * d'accès : plus de routeur tiers dans l'équation, donc plus d'isolation à
 * contourner. Le protocole de synchro lui-même ne change pas (mêmes routes
 * `/api/sync/*`, même port) — seule la couche physique change.
 *
 * Mécanisme technique : l'API WinRT `NetworkOperatorTetheringManager` n'est
 * exposée qu'en PowerShell/WinRT, pas directement en Node.js — on passe donc
 * par des scripts PowerShell, écrits sur disque puis exécutés (jamais de
 * commande inline avec quoting fragile). Démarrer/arrêter le point d'accès
 * modifie l'état réseau du système : comme pour le pare-feu
 * (`src/lib/sync/firewall.ts`), ça passe par une élévation UAC explicite —
 * jamais silencieusement. Lire le statut actuel ne modifie rien et ne
 * nécessite donc pas d'élévation.
 */

import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { randomUUID, randomInt } from "crypto";

export interface HotspotStatus {
  /** `null` si le statut n'a pas pu être lu (API indisponible, erreur PowerShell...). */
  isActive: boolean | null;
  ssid: string | null;
}

export interface HotspotCredentials {
  ssid: string;
  password: string;
}

const WINRT_TETHERING_PRELUDE = [
  "$ErrorActionPreference = 'Stop'",
  "Add-Type -AssemblyName System.Runtime.WindowsRuntime",
  "[Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime] | Out-Null",
  "[Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime] | Out-Null",
  "function Await($WinRtTask, $ResultType) {",
  "  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {",
  "    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'",
  "  })[0]",
  "  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)",
  "  $netTask = $asTask.Invoke($null, @($WinRtTask))",
  "  $netTask.Wait(-1) | Out-Null",
  "  return $netTask.Result",
  "}",
  "function Get-Tethering-Manager {",
  "  $connectionProfile = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()",
  "  if (-not $connectionProfile) { throw 'Aucune connexion internet active sur ce PC.' }",
  "  return [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($connectionProfile)",
  "}",
].join("\r\n");

async function runPowerShellFile(scriptContent: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  const scriptPath = path.join(os.tmpdir(), `findit-hotspot-${randomUUID()}.ps1`);
  await fs.writeFile(scriptPath, scriptContent, "utf-8");
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath]);
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
      child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
      child.on("error", reject);
      child.on("close", (code) => resolve({ stdout, stderr, code }));
    });
  } finally {
    await fs.unlink(scriptPath).catch(() => {});
  }
}

/**
 * Lit le statut actuel du point d'accès mobile (actif ou non, SSID) sans
 * élévation. Retourne des valeurs `null` plutôt que de lever une erreur si
 * l'API WinRT n'est pas disponible (édition de Windows, machine hors
 * réseau...) — ce statut est indicatif, jamais bloquant pour le reste des
 * Réglages.
 */
export async function getHotspotStatus(): Promise<HotspotStatus> {
  if (process.platform !== "win32") {
    return { isActive: null, ssid: null };
  }

  const script = [
    WINRT_TETHERING_PRELUDE,
    "try {",
    "  $manager = Get-Tethering-Manager",
    "  $config = $manager.GetCurrentAccessPointConfiguration()",
    "  $state = $manager.TetheringOperationalState",
    "  [PSCustomObject]@{ isActive = ($state -eq 1); ssid = $config.Ssid } | ConvertTo-Json -Compress",
    "} catch {",
    "  [PSCustomObject]@{ isActive = $null; ssid = $null } | ConvertTo-Json -Compress",
    "}",
  ].join("\r\n");

  try {
    const { stdout } = await runPowerShellFile(script);
    const parsed = JSON.parse(stdout.trim()) as { isActive: boolean | null; ssid: string | null };
    return { isActive: parsed.isActive ?? null, ssid: parsed.ssid ?? null };
  } catch {
    return { isActive: null, ssid: null };
  }
}

/** Génère un SSID et un mot de passe éphémères pour cette session de synchro. */
function generateCredentials(): HotspotCredentials {
  const suffix = randomInt(1000, 9999);
  const password = Array.from({ length: 12 }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"[randomInt(0, 56)]
  ).join("");
  return { ssid: `FindIt-PC-${suffix}`, password };
}

/**
 * Démarre le point d'accès mobile avec des identifiants générés pour cette
 * session, via une invite d'élévation Windows (popup UAC natif — jamais de
 * modification silencieuse de l'état réseau). Retourne les identifiants une
 * fois le point d'accès effectivement actif, ou lève une erreur explicite
 * sinon (refus de l'invite, API indisponible, pas de connexion internet à
 * partager...).
 */
export async function startHotspotElevated(): Promise<HotspotCredentials> {
  if (process.platform !== "win32") {
    throw new Error("Cette action n'est disponible que sur Windows.");
  }

  const credentials = generateCredentials();
  const resultPath = path.join(os.tmpdir(), `findit-hotspot-result-${randomUUID()}.json`);

  const innerScript = [
    WINRT_TETHERING_PRELUDE,
    "try {",
    "  $manager = Get-Tethering-Manager",
    "  $config = $manager.GetCurrentAccessPointConfiguration()",
    `  $config.Ssid = '${credentials.ssid.replace(/'/g, "''")}'`,
    `  $config.Passphrase = '${credentials.password.replace(/'/g, "''")}'`,
    "  $manager.ConfigureAccessPointAsync($config) | Out-Null",
    "  $result = Await ($manager.StartTetheringAsync()) ([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult])",
    "  $ok = ($manager.TetheringOperationalState -eq 1)",
    `  [PSCustomObject]@{ ok = $ok; error = $null } | ConvertTo-Json -Compress | Set-Content -Path '${resultPath.replace(/'/g, "''")}' -Encoding UTF8`,
    "} catch {",
    `  [PSCustomObject]@{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress | Set-Content -Path '${resultPath.replace(/'/g, "''")}' -Encoding UTF8`,
    "}",
  ].join("\r\n");

  const innerScriptPath = path.join(os.tmpdir(), `findit-hotspot-start-${randomUUID()}.ps1`);
  await fs.writeFile(innerScriptPath, innerScript, "utf-8");

  try {
    await new Promise<void>((resolve, reject) => {
      const outer = spawn("powershell.exe", [
        "-NoProfile",
        "-Command",
        `Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${innerScriptPath.replace(/'/g, "''")}'`,
      ]);
      outer.on("error", reject);
      outer.on("close", () => resolve());
    });

    const raw = await fs.readFile(resultPath, "utf-8").catch(() => null);
    if (!raw) {
      throw new Error(
        "Le point d'accès n'a pas démarré — l'invite Windows a peut-être été refusée."
      );
    }
    const parsed = JSON.parse(raw) as { ok: boolean; error: string | null };
    if (!parsed.ok) {
      throw new Error(parsed.error || "Échec du démarrage du point d'accès mobile.");
    }
    return credentials;
  } finally {
    await fs.unlink(innerScriptPath).catch(() => {});
    await fs.unlink(resultPath).catch(() => {});
  }
}

/** Arrête le point d'accès mobile, via la même invite d'élévation. */
export async function stopHotspotElevated(): Promise<void> {
  if (process.platform !== "win32") return;

  const innerScript = [
    WINRT_TETHERING_PRELUDE,
    "try {",
    "  $manager = Get-Tethering-Manager",
    "  Await ($manager.StopTetheringAsync()) ([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult]) | Out-Null",
    "} catch {}",
  ].join("\r\n");

  const innerScriptPath = path.join(os.tmpdir(), `findit-hotspot-stop-${randomUUID()}.ps1`);
  await fs.writeFile(innerScriptPath, innerScript, "utf-8");

  try {
    await new Promise<void>((resolve, reject) => {
      const outer = spawn("powershell.exe", [
        "-NoProfile",
        "-Command",
        `Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${innerScriptPath.replace(/'/g, "''")}'`,
      ]);
      outer.on("error", reject);
      outer.on("close", () => resolve());
    });
  } finally {
    await fs.unlink(innerScriptPath).catch(() => {});
  }
}

/**
 * Adresse IPv4 du PC sur l'interface créée par le point d'accès mobile
 * (celle que les appareils connectés au hotspot utilisent comme
 * passerelle). Windows nomme cette interface virtuelle de façon variable
 * selon les versions ("Réseau de zone locale* N", "Local Area Connection*
 * N"...) — plutôt que de deviner un nom, on identifie l'interface par son
 * préfixe d'adresse habituel (192.168.137.x, valeur fixe de l'Internet
 * Connection Sharing de Windows depuis de nombreuses versions) parmi les
 * interfaces actives.
 */
export function getHotspotIPv4(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const addresses = interfaces[name];
    if (!addresses) continue;
    for (const addr of addresses) {
      if (addr.family === "IPv4" && !addr.internal && addr.address.startsWith("192.168.137.")) {
        return addr.address;
      }
    }
  }
  return null;
}
