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
 * Download a file from `url` to `destPath`, calling `onProgress(0–1)` during download.
 * Handles HTTP redirects (GitHub asset URLs redirect to CDN).
 */
export function downloadUpdate(
  url: string,
  destPath: string,
  onProgress: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doGet = (currentUrl: string, redirectCount = 0): void => {
      if (redirectCount > 10) { reject(new Error('重定向次数过多')); return }

      const mod: typeof https | typeof http = currentUrl.startsWith('https') ? https : http
      const req = mod.get(currentUrl, { headers: { 'User-Agent': `MouseClicker/${app.getVersion()}` } }, (res) => {
        // Follow redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          doGet(res.headers.location, redirectCount + 1)
          return
        }
        if (res.statusCode && res.statusCode !== 200) {
          res.resume()
          reject(new Error(`下载失败，HTTP ${res.statusCode}`))
          return
        }

        const total = parseInt(String(res.headers['content-length'] ?? '0'), 10)
        let received = 0
        const writeStream = fs.createWriteStream(destPath)

        res.on('data', (chunk: Buffer) => {
          received += chunk.length
          if (total > 0) onProgress(Math.min(received / total, 0.99))
        })

        res.pipe(writeStream)
        writeStream.on('finish', () => { onProgress(1); resolve() })
        writeStream.on('error', (err) => { fs.unlink(destPath, () => {}); reject(err) })
        res.on('error', reject)
      })
      req.on('error', reject)
    }
    doGet(url)
  })
}
