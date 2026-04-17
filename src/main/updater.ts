import { net, app } from 'electron'

export interface ReleaseInfo {
  tag: string
  version: string
  url: string
  publishedAt: string
  notes: string
}

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
          const release = JSON.parse(body)
          const tag: string = release.tag_name ?? ''
          const latestVer = tag.replace(/^v/, '')
          const currentVer = app.getVersion()
          if (isNewer(latestVer, currentVer)) {
            resolve({
              tag,
              version: latestVer,
              url: release.html_url ?? '',
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
