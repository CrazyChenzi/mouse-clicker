import { desktopCapturer, screen, systemPreferences } from 'electron'
import Jimp from 'jimp'
import * as fs from 'fs'
import { exec, spawn } from 'child_process'

export interface MatchResult {
  x: number   // logical screen x (for robotjs)
  y: number   // logical screen y
  confidence: number
}

/** Capture the primary display as a PNG Buffer */
async function captureScreen(): Promise<Buffer> {
  if (process.platform === 'darwin') return captureScreenMacOS()
  return captureScreenDesktopCapturer()
}

/**
 * macOS screen capture with three-level fallback strategy:
 *  1. screencapture → stdout  (no file I/O, fastest)
 *  2. screencapture → /tmp file  (fallback if stdout fails)
 *  3. desktopCapturer  (last resort, may produce blank image without permission)
 *
 * Uses /usr/sbin/screencapture with full path so Electron's PATH doesn't matter.
 * Also checks systemPreferences.getMediaAccessStatus('screen') upfront.
 */
async function captureScreenMacOS(): Promise<Buffer> {
  // Check permission status first — gives a clear error message
  const status = (systemPreferences as unknown as Record<string, (s: string) => string>)
    .getMediaAccessStatus?.('screen') ?? 'unknown'

  if (status === 'denied') {
    throw new Error(
      '屏幕录制权限已被拒绝。\n' +
      '请前往：系统设置 → 隐私与安全性 → 屏幕录制\n' +
      '找到本应用并启用，然后重启应用再试。'
    )
  }

  // Strategy 1: screencapture → stdout (no file system involved)
  try {
    return await screencaptureToStdout()
  } catch (e1) {
    console.warn('[screenshot] stdout failed:', (e1 as Error).message)
  }

  // Strategy 2: screencapture → temp file
  try {
    return await screencaptureToFile()
  } catch (e2) {
    console.warn('[screenshot] file failed:', (e2 as Error).message)
    // Re-throw with helpful message
    throw new Error(
      '屏幕截图失败。如果已授权屏幕录制权限，请重启应用后再试。\n' +
      '（系统设置 → 隐私与安全性 → 屏幕录制）'
    )
  }
}

/** screencapture → stdout (avoids all file-system permission issues) */
function screencaptureToStdout(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    // Use full path; '-' as filename means write to stdout
    const proc = spawn('/usr/sbin/screencapture', ['-x', '-t', 'png', '-'])
    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    const done = (code: number | null): void => {
      const buf = Buffer.concat(chunks)
      if (code === 0 && buf.length > 5000) {
        resolve(buf)
      } else {
        reject(new Error(`exit ${code}, size ${buf.length}`))
      }
    }
    proc.on('close', done)
    proc.on('error', reject)
    setTimeout(() => { proc.kill(); reject(new Error('timeout')) }, 10_000)
  })
}

/** screencapture → /tmp file (fallback) */
function screencaptureToFile(): Promise<Buffer> {
  // Use /tmp directly (universally writable on macOS, unlike os.tmpdir() in some sandbox configs)
  const tmpPath = `/tmp/mc-cap-${Date.now()}.png`
  return new Promise((resolve, reject) => {
    exec(`/usr/sbin/screencapture -x "${tmpPath}"`, { timeout: 10_000 }, (err, _stdout, stderr) => {
      if (err) {
        reject(new Error(`screencapture error: ${stderr?.trim() || err.message}`))
        return
      }
      try {
        const buf = fs.readFileSync(tmpPath)
        try { fs.unlinkSync(tmpPath) } catch { /* ignore */ }
        if (buf.length < 5000) {
          reject(new Error(`screenshot too small (${buf.length} bytes) — permission may not be granted`))
          return
        }
        resolve(buf)
      } catch (e) {
        reject(e)
      }
    })
  })
}

/** Windows / other: use Electron's desktopCapturer */
async function captureScreenDesktopCapturer(): Promise<Buffer> {
  const display = screen.getPrimaryDisplay()
  const { scaleFactor } = display
  const { width, height } = display.size
  const physW = Math.round(width * scaleFactor)
  const physH = Math.round(height * scaleFactor)

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: physW, height: physH }
  })
  if (sources.length === 0) throw new Error('屏幕截图失败：未找到屏幕源，请检查屏幕录制权限')
  const source = sources.find(s => s.name.includes('1') || s.name.toLowerCase().includes('entire')) ?? sources[0]
  const png = source.thumbnail.toPNG()
  if (png.length < 1000) throw new Error('屏幕截图返回空白图像，请检查屏幕录制权限')
  return png
}

/**
 * Find templateBase64 inside a screenshot.
 * Uses multi-scale SAD (sum of absolute differences) with coarse→fine strategy.
 * Returns the logical screen coordinate of the template centre, or null if not found.
 */
export async function findImageOnScreen(
  templateBase64: string,
  confidence = 0.8
): Promise<MatchResult | null> {
  const display = screen.getPrimaryDisplay()
  const scaleFactor = display.scaleFactor

  const [screenshotPng, templateBuf] = await Promise.all([
    captureScreen(),
    Promise.resolve(Buffer.from(templateBase64.replace(/^data:[^;]+;base64,/, ''), 'base64'))
  ])

  const [ssImg, tmImg] = await Promise.all([
    Jimp.read(screenshotPng),
    Jimp.read(templateBuf)
  ])

  // ── Coarse search at 1/4 resolution ────────────────────────────────────────
  const COARSE = 4
  const ssW = ssImg.bitmap.width
  const ssH = ssImg.bitmap.height
  const tmW = tmImg.bitmap.width
  const tmH = tmImg.bitmap.height

  if (tmW > ssW || tmH > ssH) return null

  const ssData = ssImg.bitmap.data
  const tmData = tmImg.bitmap.data

  let bestScore = 0
  let bestX = 0
  let bestY = 0

  // SAD-based matching with step sampling
  const STEP = COARSE
  const tmSampleW = Math.max(1, Math.floor(tmW / STEP))
  const tmSampleH = Math.max(1, Math.floor(tmH / STEP))
  const maxDiff = tmSampleW * tmSampleH * 3 * 255  // max possible SAD (3 channels)

  for (let sy = 0; sy <= ssH - tmH; sy += STEP) {
    for (let sx = 0; sx <= ssW - tmW; sx += STEP) {
      let sad = 0
      for (let ty = 0; ty < tmH; ty += STEP) {
        for (let tx = 0; tx < tmW; tx += STEP) {
          const si = ((sy + ty) * ssW + (sx + tx)) * 4
          const ti = (ty * tmW + tx) * 4
          sad += Math.abs(ssData[si] - tmData[ti])
            + Math.abs(ssData[si + 1] - tmData[ti + 1])
            + Math.abs(ssData[si + 2] - tmData[ti + 2])
        }
      }
      const score = 1 - sad / maxDiff
      if (score > bestScore) {
        bestScore = score
        bestX = sx
        bestY = sy
      }
    }
  }

  if (bestScore < confidence * 0.9) return null  // fast reject

  // ── Fine search around best coarse match (±STEP pixels) ───────────────────
  const fineRadius = STEP * 2
  const fxStart = Math.max(0, bestX - fineRadius)
  const fyStart = Math.max(0, bestY - fineRadius)
  const fxEnd = Math.min(ssW - tmW, bestX + fineRadius)
  const fyEnd = Math.min(ssH - tmH, bestY + fineRadius)
  const fineTmSampleW = Math.max(1, Math.floor(tmW / 2))
  const fineTmSampleH = Math.max(1, Math.floor(tmH / 2))
  const fineMaxDiff = fineTmSampleW * fineTmSampleH * 3 * 255

  let fineScore = 0
  let fineX = bestX
  let fineY = bestY

  for (let sy = fyStart; sy <= fyEnd; sy++) {
    for (let sx = fxStart; sx <= fxEnd; sx++) {
      let sad = 0
      for (let ty = 0; ty < tmH; ty += 2) {
        for (let tx = 0; tx < tmW; tx += 2) {
          const si = ((sy + ty) * ssW + (sx + tx)) * 4
          const ti = (ty * tmW + tx) * 4
          sad += Math.abs(ssData[si] - tmData[ti])
            + Math.abs(ssData[si + 1] - tmData[ti + 1])
            + Math.abs(ssData[si + 2] - tmData[ti + 2])
        }
      }
      const score = 1 - sad / fineMaxDiff
      if (score > fineScore) {
        fineScore = score
        fineX = sx
        fineY = sy
      }
    }
  }

  if (fineScore < confidence) return null

  // Convert physical pixel coordinates → logical screen coordinates for robotjs
  const logicalX = Math.round((fineX + tmW / 2) / scaleFactor)
  const logicalY = Math.round((fineY + tmH / 2) / scaleFactor)

  return { x: logicalX, y: logicalY, confidence: fineScore }
}

/** Read a file and return it as a base64 data URL */
export function fileToBase64(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? 'png'
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
  const data = fs.readFileSync(filePath)
  return `data:${mime};base64,${data.toString('base64')}`
}

/**
 * Capture a region of the primary display and return it as a base64 PNG.
 * `region` uses logical (CSS) screen coordinates.
 */
export async function captureAndCropRegion(
  region: { x: number; y: number; width: number; height: number }
): Promise<{ base64: string; centerX: number; centerY: number }> {
  const display = screen.getPrimaryDisplay()
  const { scaleFactor } = display

  // captureScreen() uses screencapture on macOS (full physical resolution PNG)
  // and desktopCapturer on Windows
  const screenshotPng = await captureScreen()

  const img = await Jimp.read(screenshotPng)

  // Convert logical coords → physical pixels for cropping
  const cropX = Math.round(region.x * scaleFactor)
  const cropY = Math.round(region.y * scaleFactor)
  const cropW = Math.max(1, Math.round(region.width * scaleFactor))
  const cropH = Math.max(1, Math.round(region.height * scaleFactor))

  img.crop(cropX, cropY, cropW, cropH)
  const base64 = await img.getBase64Async(Jimp.MIME_PNG)

  return {
    base64,
    centerX: Math.round(region.x + region.width / 2),
    centerY: Math.round(region.y + region.height / 2)
  }
}
