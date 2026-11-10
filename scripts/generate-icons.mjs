// Regenerates the app icons in public/. Run with: node scripts/generate-icons.mjs
// Dependency-free: draws a few four-point sparkles and encodes PNGs with node's zlib.
import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { stdout } from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { deflateSync } from 'node:zlib';

const BG = [0x14, 0x14, 0x1a];
const PINK = [0xe0, 0x5c, 0xcd];
const GOLD = [0xff, 0xd7, 0x5e];

// A sparkle is |dx|^0.6 + |dy|^0.6 <= r^0.6: a four-point star with concave sides.
const inStar = (x, y, s) => Math.abs(x - s.cx) ** 0.6 + Math.abs(y - s.cy) ** 0.6 <= s.r ** 0.6;

// Coordinates run -1..1 across the icon. `scale` shrinks the art into a maskable safe zone.
const sparkles = (scale) => [
  { cx: -0.05 * scale, cy: 0.05 * scale, r: 0.62 * scale, color: PINK },
  { cx: 0.5 * scale, cy: -0.5 * scale, r: 0.24 * scale, color: GOLD },
  { cx: -0.52 * scale, cy: 0.52 * scale, r: 0.15 * scale, color: GOLD },
];

function render(size, scale) {
  const stars = sparkles(scale);
  const samples = 4;
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // PNG filter type: none
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0];
      for (let i = 0; i < samples; i++) {
        for (let j = 0; j < samples; j++) {
          const sx = ((x + (i + 0.5) / samples) / size) * 2 - 1;
          const sy = ((y + (j + 0.5) / samples) / size) * 2 - 1;
          const color = stars.find((s) => inStar(sx, sy, s))?.color ?? BG;
          for (let c = 0; c < 3; c++) sum[c] += color[c];
        }
      }
      const offset = y * stride + 1 + x * 4;
      for (let c = 0; c < 3; c++) raw[offset + c] = Math.round(sum[c] / samples ** 2);
      raw[offset + 3] = 255;
    }
  }
  return raw;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, scale) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(render(size, scale))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = (path) => fileURLToPath(new URL(`../public/${path}`, import.meta.url));
mkdirSync(out('icons'), { recursive: true });

writeFileSync(out('icons/icon-192.png'), png(192, 1));
writeFileSync(out('icons/icon-512.png'), png(512, 1));
writeFileSync(out('icons/maskable-512.png'), png(512, 0.8));
writeFileSync(out('apple-touch-icon.png'), png(180, 1));

const star = (cx, cy, r, fill) =>
  `<path d="M${cx},${cy - r}Q${cx},${cy} ${cx + r},${cy}Q${cx},${cy} ${cx},${cy + r}Q${cx},${cy} ${cx - r},${cy}Q${cx},${cy} ${cx},${cy - r}Z" fill="${fill}"/>`;
writeFileSync(
  out('favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#14141a"/>${star(47, 53, 31, '#e05ccd')}${star(75, 25, 12, '#ffd75e')}${star(24, 76, 7.5, '#ffd75e')}</svg>\n`,
);
stdout.write('Icons written to public/\n');
