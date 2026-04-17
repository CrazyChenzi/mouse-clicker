import { net, app } from 'electron'
import * as https from 'https'
import * as http from 'http'
import * as fs from 'fs'
import { ReleaseInfo } from '../renderer/src/types'

const REPO = 'CrazyChenzi/mouse-clicker'

function isNewer(latest: string, current: string): boolean {
  const parse = (v: string): number[] => v.replace(/^v/, '').split('.').map(Number)
  const a = parse(latest)
  const b = parse(current)
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false
  }
  return false
}

/** Pick the correct download asset for the running platform/arch */
function getAssetUrl(assets: Array<{ name: string; browser_download_url: string }>): string {
  const plat = process.platform
  const arch = process.arch
  for (const asset of assets) {
    const name = asset.name.toLowerCase()
    if (plat === 'darwin') {
      if (arch === 'arm64' && name.includes('arm64') && name.endsWith('.dmg')) {
        return asset.browser_download_url
      }
      if (arch !== 'arm64' && !name.includes('arm64') && name.endsWith('.dmg')) {
        return asset.browser_download_url
      }
    } else if (plat === 'win32') {
      if (name.endsWith('.exe')) return asset.browser_download_url
    }
  }
  return ''
}

export function checkForUpdates(): Promise<ReleaseInfo | null> {
  return new Promise((resolve, reject) => {
    const req = net.request({
      url: `https://api.github.com/repos/${REPO}/releases/latest`,
      method: 'GET'
    })
    req.setHeader('User-Agent', `MouseClicker/${app.getVersion()}`)
    req.setHeader('Accept', 'application/vnd.github+json')

    let body = ''
    req.on('response', (res) => {
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        try {
          if (res.statusCode === 404) {
            reject(new Error('GitHub 上暂无已发布的版本，请先在 GitHub Releases 页面将 Draft Release 发布'))
            return
          }
          if (res.statusCode !== 200) {
            reject(new Error(`GitHub API 返回错误 (HTTP ${res.statusCode})，请稍后重试`))
            return
          }
          const release = JSON.parse(body)
          const tag: string = release.tag_name ?? ''
          if (!tag) { resolve(null); return }

          const latestVer = tag.replace(/^v/, '')
          const currentVer = app.getVersion()
          if (isNewer(latestVer, currentVer)) {
            const assets: Array<{ name: string; browser_download_url: string }> = release.assets ?? []
            resolve({
              tag,
              version: latestVer,
              url: release.html_url ?? '',
              downloadUrl: getAssetUrl(assets),
              publishedAt: release.published_at ?? '',
              notes: (release.body ?? '').slice(0, 500)
            })
          } else {
            resolve(null)
          }
        } catch (e) {
          reject(e)
        }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

/**
 * Download a file from `url` to `destPath`, with resume support.
 * - Checks for an existing partial file and a sidecar `.info` (total size).
 * - Sends `Range: bytes=N-` to resume; server 206 → append, server 200 → restart.
 * - `onProgress(0–1)` is called immediately with resume progress, then as bytes arrive.
 */
export function downloadUpdate(
  url: string,
  destPath: string,
  onProgress: (progress: number) => void
): Promise<void> {
  const infoPath = destPath + '.info'

  // Read partial download state
  let startByte = 0
  let knownTotal = 0
  if (fs.existsSync(destPath)) {
    try { startByte = fs.statSync(destPath).size } catch { startByte = 0 }
  }
  if (fs.existsSync(infoPath)) {
    try { knownTotal = parseInt(fs.readFileSync(infoPath, 'utf8'), 10) || 0 } catch { knownTotal = 0 }
  }

  // Emit initial progress if resuming a partial download
  if (startByte > 0 && knownTotal > 0) {
    onProgress(Math.min(startByte / knownTotal, 0.99))
  }

  return new Promise((resolve, reject) => {
    const doGet = (currentUrl: string, resumeFrom: number, redirectCount = 0): void => {
      if (redirectCount > 10) { reject(new Error('重定向次数过多')); return }

      const mod: typeof https | typeof http = currentUrl.startsWith('https') ? https : http
      const headers: Record<string, string> = { 'User-Agent': `MouseClicker/${app.getVersion()}` }
      if (resumeFrom > 0) headers['Range'] = `bytes=${resumeFrom}-`

      const req = mod.get(currentUrl, { headers }, (res) => {
        // Follow redirects (preserve Range header so CDN also supports resume)
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          doGet(res.headers.location, resumeFrom, redirectCount + 1)
          return
        }

        // 416 Range Not Satisfiable → file may already be complete, or bad offset
        if (res.statusCode === 416) {
          res.resume()
          // Delete corrupted partial and restart
          try { fs.unlinkSync(destPath) } catch { /* ignore */ }
          try { fs.unlinkSync(infoPath) } catch { /* ignore */ }
          doGet(currentUrl, 0, redirectCount)
          return
        }

        if (res.statusCode !== 200 && res.statusCode !== 206) {
          res.resume()
          reject(new Error(`下载失败，HTTP ${res.statusCode}`))
          return
        }

        const isResume = res.statusCode === 206
        let total = knownTotal
        let alreadyBytes = 0

        if (isResume) {
          // Content-Range: bytes start-end/total
          const m = res.headers['content-range']?.match(/bytes (\d+)-\d+\/(\d+)/)
          if (m) {
            alreadyBytes = parseInt(m[1], 10)
            total = parseInt(m[2], 10)
          }
        } else {
          // Server ignored Range header → full download, overwrite
          total = parseInt(String(res.headers['content-length'] ?? '0'), 10)
          alreadyBytes = 0
          if (fs.existsSync(destPath)) { try { fs.unlinkSync(destPath) } catch { /* ignore */ } }
        }

        // Persist total size for future resume sessions
        if (total > 0) {
          try { fs.writeFileSync(infoPath, String(total), 'utf8') } catch { /* ignore */ }
        }

        let received = alreadyBytes
        const writeFlags = alreadyBytes > 0 ? 'a' : 'w'
        const writeStream = fs.createWriteStream(destPath, { flags: writeFlags })

        // Emit accurate initial progress for resume case
        if (total > 0 && alreadyBytes > 0) onProgress(alreadyBytes / total)

        res.on('data', (chunk: Buffer) => {
          received += chunk.length
          if (total > 0) onProgress(Math.min(received / total, 0.99))
        })

        res.pipe(writeStream)
        writeStream.on('finish', () => {
          // Clean up sidecar info file on successful completion
          try { fs.unlinkSync(infoPath) } catch { /* ignore */ }
          onProgress(1)
          resolve()
        })
        writeStream.on('error', (err) => {
          // Keep partial file intact for next resume attempt
          reject(err)
        })
        res.on('error', reject)
      })
      req.on('error', reject)
    }

    doGet(url, startByte)
  })
}
