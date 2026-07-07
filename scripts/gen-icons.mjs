// Generates PWA icons from an inline SVG (barbell mark on dark ground).
// Run: node scripts/gen-icons.mjs
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const icon = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 96}" fill="#0f1115"/>
  <g transform="translate(256 256) scale(${pad ? 0.72 : 0.88}) translate(-256 -256)">
    <rect x="76" y="240" width="360" height="32" rx="16" fill="#4f8ef7"/>
    <rect x="96" y="176" width="48" height="160" rx="14" fill="#e8ecf3"/>
    <rect x="368" y="176" width="48" height="160" rx="14" fill="#e8ecf3"/>
    <rect x="56" y="204" width="32" height="104" rx="12" fill="#8b94a7"/>
    <rect x="424" y="204" width="32" height="104" rx="12" fill="#8b94a7"/>
    <circle cx="256" cy="120" r="34" fill="#3ecf8e"/>
  </g>
</svg>`

mkdirSync('public/icons', { recursive: true })

const jobs = [
  ['public/icons/icon-192.png', 192, false],
  ['public/icons/icon-512.png', 512, false],
  ['public/icons/maskable-512.png', 512, true],
  ['public/icons/apple-touch-icon.png', 180, true],
]

for (const [path, size, maskable] of jobs) {
  await sharp(Buffer.from(icon(maskable))).resize(size, size).png().toFile(path)
  console.log('wrote', path)
}
