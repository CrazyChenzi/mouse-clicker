/**
 * Generates resources/icon.png — a 1024×1024 app icon for Mouse Clicker.
 * Uses jimp (already a project dep) for zero extra dependencies.
 * Run: node scripts/generate-icon.mjs
 */

import Jimp from 'jimp'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SIZE = 1024

// ── Helpers ────────────────────────────────────────────────────────────────
function setPixel(img, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return
  img.setPixelColor(Jimp.rgbaToInt(r, g, b, Math.max(0, Math.min(255, a))), x, y)
}

/** Scanline-fill a convex polygon with solid color */
function fillPolygon(img, verts, r, g, b, a = 255) {
  const minY = Math.floor(Math.min(...verts.map(v => v[1])))
  const maxY = Math.ceil(Math.max(...verts.map(v => v[1])))
  const closed = [...verts, verts[0]]
  for (let y = minY; y <= maxY; y++) {
    const xs = []
    for (let i = 0; i < closed.length - 1; i++) {
      const [x1, y1] = closed[i]
      const [x2, y2] = closed[i + 1]
      if (Math.min(y1, y2) <= y && y < Math.max(y1, y2)) {
        xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1))
      }
    }
    xs.sort((a, b) => a - b)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.round(xs[k]); x <= Math.round(xs[k + 1]); x++) {
        setPixel(img, x, y, r, g, b, a)
      }
    }
  }
}

/** Draw an anti-aliased thick line */
function drawLine(img, x1, y1, x2, y2, r, g, b, thick = 2) {
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return
  const steps = Math.ceil(len * 2)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const cx = x1 + dx * t, cy = y1 + dy * t
    for (let ox = -thick; ox <= thick; ox++) {
      for (let oy = -thick; oy <= thick; oy++) {
        if (ox * ox + oy * oy <= thick * thick) {
          setPixel(img, Math.round(cx + ox), Math.round(cy + oy), r, g, b)
        }
      }
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
const img = new Jimp(SIZE, SIZE, 0x00000000)

const cx = SIZE / 2, cy = SIZE / 2
const R = SIZE / 2 - 20   // circle radius

// 1. Gradient background circle (indigo #4f46e5 → violet #7c3aed)
const C1 = { r: 0x4f, g: 0x46, b: 0xe5 }
const C2 = { r: 0x7c, g: 0x3a, b: 0xed }
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const dx = x - cx, dy = y - cy
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d > R + 2) continue
    const t = y / SIZE
    const rc = Math.round(C1.r + (C2.r - C1.r) * t)
    const gc = Math.round(C1.g + (C2.g - C1.g) * t)
    const bc = Math.round(C1.b + (C2.b - C1.b) * t)
    const alpha = d > R - 2 ? Math.round(255 * (R + 2 - d) / 4) : 255
    setPixel(img, x, y, rc, gc, bc, alpha)
  }
}

// 2. Subtle inner shadow (darker ring at bottom-right)
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const dx = x - cx, dy = y - cy
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < R - 60 || d > R) continue
    const angle = Math.atan2(dy, dx)   // -π to π
    // shadow at bottom-right (around 45°)
    const shadowFactor = Math.max(0, (angle / Math.PI) * 0.5 + 0.25) * ((d - (R - 60)) / 60)
    const a = Math.round(shadowFactor * 50)
    if (a > 0) setPixel(img, x, y, 0, 0, 0, a)
  }
}

// 3. Mouse cursor arrow (white, pointing top-left)
//    Defined in a 0-1 space, then scaled & positioned
const ARROW_SCALE = SIZE * 0.42
const ARROW_OX = SIZE * 0.23
const ARROW_OY = SIZE * 0.18

function ap(nx, ny) {
  return [ARROW_OX + nx * ARROW_SCALE, ARROW_OY + ny * ARROW_SCALE]
}

// Outer arrow shape
const arrowOuter = [
  ap(0.00, 0.00),   // tip
  ap(0.00, 0.72),   // left bottom
  ap(0.18, 0.55),   // notch left
  ap(0.33, 0.82),   // tail bottom-left
  ap(0.46, 0.77),   // tail bottom-right
  ap(0.29, 0.48),   // notch right
  ap(0.52, 0.48),   // right of head
]
fillPolygon(img, arrowOuter, 255, 255, 255, 255)

// Dark outline / shadow on cursor (subtle, 3px)
// Re-draw the outline with a semi-transparent dark stroke
const outlineOuter = arrowOuter.map(([x, y]) => [x + 3, y + 3])
fillPolygon(img, outlineOuter, 20, 10, 60, 60)
// Re-draw white on top to keep it crisp
fillPolygon(img, arrowOuter, 255, 255, 255, 255)

// 4. Click ripple circles (bottom-right of cursor)
const rippleCX = ARROW_OX + 0.52 * ARROW_SCALE + 40
const rippleCY = ARROW_OY + 0.70 * ARROW_SCALE + 40
for (let i = 0; i < 3; i++) {
  const rr = 22 + i * 22
  const alpha = Math.round(200 - i * 60)
  for (let angle = 0; angle < Math.PI * 2; angle += 0.02) {
    const px = Math.round(rippleCX + Math.cos(angle) * rr)
    const py = Math.round(rippleCY + Math.sin(angle) * rr)
    setPixel(img, px, py, 255, 255, 255, alpha)
    setPixel(img, px + 1, py, 255, 255, 255, alpha)
    setPixel(img, px, py + 1, 255, 255, 255, alpha)
  }
}

// 5. Write output
const outDir = path.join(__dirname, '..', 'resources')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'icon.png')
await img.writeAsync(outPath)
console.log(`✓ Icon written to ${outPath}`)
