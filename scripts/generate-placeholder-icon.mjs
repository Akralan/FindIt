#!/usr/bin/env node
/**
 * Génère electron/icon.png : une icône placeholder (carré plein, 512x512)
 * pour ne pas bloquer le packaging Electron sur l'absence d'asset design.
 * À REMPLACER par une vraie icône FindIt (même chemin, même format PNG
 * carré >=256x256 — electron-builder génère l'.ico Windows à partir de ça).
 *
 * Écrit un PNG minimal à la main (IHDR + IDAT + IEND) sans dépendance
 * externe : une seule couleur plate, pas de compression fine nécessaire.
 */
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "electron", "icon.png");
const SIZE = 512;
// Bleu ardoise proche du design de la landing FindIt — à ajuster si besoin.
const [R, G, B] = [0x1e, 0x3a, 0x5f];

function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// IHDR : 8 bits/canal, RGB (type couleur 2), pas d'interlace.
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr.writeUInt8(8, 8);
ihdr.writeUInt8(2, 9);
ihdr.writeUInt8(0, 10);
ihdr.writeUInt8(0, 11);
ihdr.writeUInt8(0, 12);

// Raw scanlines : chaque ligne préfixée d'un octet filter=0.
const rowLen = SIZE * 3;
const raw = Buffer.alloc((rowLen + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (rowLen + 1);
  raw[rowStart] = 0;
  for (let x = 0; x < SIZE; x++) {
    const px = rowStart + 1 + x * 3;
    raw[px] = R;
    raw[px + 1] = G;
    raw[px + 2] = B;
  }
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync(OUT, png);
console.log(`Icône placeholder écrite : ${OUT}`);
