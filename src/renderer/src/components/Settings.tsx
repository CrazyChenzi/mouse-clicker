import React, { useState, useEffect, useRef } from 'react'
import { HotkeyConfig, ReleaseInfo, AppSettings } from '../types'

interface Props {
  hotkey: HotkeyConfig
  onSaveHotkey: (config: HotkeyConfig) => void
  settings: AppSettings
  onSettingsChange: (s: AppSettings) => void
}

const PRESET_KEYS = ['F6', 'F7', 'F8', 'F9', 'F10', 'F12']

type UpdateState = 'idle' | 'checking' | 'latest' | 'available' | 'downloading' | 'downloaded' | 'error'

export default function Settings({ hotkey, onSaveHotkey, settings, onSettingsChange }: Props): React.JSX.Element {
  const [key, setKey] = useState(hotkey.startStop)
  const [customKey, setCustomKey] = useState('')
  const [hotkeyMode, setHotkeyMode] = useState<'preset' | 'custom'>(
    PRESET_KEYS.includes(hotkey.startStop) ? 'preset' : 'custom'
  )
  const [hotkeySaved, setHotkeySaved] = useState(false)
  const [version, setVersion] = useState('')
  const [updateState, setUpdateState] = useState<UpdateState>('idle')
  const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null)
  const [updateError, setUpdateError] = useState('')
  const [downloadPercent, setDownloadPercent] = useState(0)
  const [downloadedPath, setDownloadedPath] = useState('')
  const unsubProgress = useRef<(() => void) | null>(null)

  useEffect(() => {
    window.clickerAPI.getVersion().then(setVersion)
  }, [])

  // Clean up progress listener on unmount
  useEffect(() => () => { unsubProgress.current?.() }, [])

  const handleSaveHotkey = async (): Promise<void> => {
    const k = hotkeyMode === 'preset' ? key : customKey
    if (!k) return
    await onSaveHotkey({ startStop: k })
    setHotkeySaved(true)
    setTimeout(() => setHotkeySaved(false), 2000)
  }

  const handleCheckUpdate = async (): Promise<void> => {
    setUpdateState('checking')
    setReleaseInfo(null)
    setUpdateError('')
    const res = await window.clickerAPI.checkForUpdates()
    if (!res.ok) {
      setUpdateState('error')
      setUpdateError(res.error ?? '检查失败，请稍后重试')
    } else if (res.info) {
      setUpdateState('available')
      setReleaseInfo(res.info)
    } else {
      setUpdateState('latest')
    }
  }

  const handleDownload = async (): Promise<void> => {
    if (!releaseInfo?.downloadUrl) {
      // No direct download link for this platform, open GitHub page
      window.open(releaseInfo?.url)
      return
    }
    setUpdateState('downloading')
    setDownloadPercent(0)

    // Subscribe to progress events
    unsubProgress.current?.()
    unsubProgress.current = window.clickerAPI.onDownloadProgress((pct) => {
      setDownloadPercent(pct)
    })

    const res = await window.clickerAPI.downloadUpdate(releaseInfo.downloadUrl)
    unsubProgress.current?.()
    unsubProgress.current = null

    if (res.ok && res.filePath) {
      setDownloadedPath(res.filePath)
      setUpdateState('downloaded')
    } else {
      setUpdateState('error')
      setUpdateError(res.error ?? '下载失败，请重试')
    }
  }

  const handleOpenFile = async (): Promise<void> => {
    await window.clickerAPI.openFile(downloadedPath)
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
      {/* Hotkey */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">全局快捷键</h3>
        <p className="text-xs text-slate-500 mb-4">在任意应用中按下即可启动/停止点击任务。</p>

        <div className="space-y-3">
          <div className="flex gap-2">
            {(['preset', 'custom'] as const).map(m => (
              <button key={m} onClick={() => setHotkeyMode(m)}
                className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${hotkeyMode === m ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-600'}`}>
                {m === 'preset' ? '预设按键' : '自定义'}
              </button>
            ))}
          </div>

          {hotkeyMode === 'preset' ? (
            <div className="grid grid-cols-3 gap-2">
              {PRESET_KEYS.map(k => (
                <button key={k} onClick={() => setKey(k)}
                  className={`py-2 text-sm font-mono rounded-lg border transition-colors ${key === k ? 'border-blue-500 bg-blue-50 text-blue-600 font-semibold' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  {k}
                </button>
              ))}
            </div>
          ) : (
            <div>
              <input type="text" value={customKey} onChange={e => setCustomKey(e.target.value)}
                placeholder="例如: CommandOrControl+Shift+S"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
              <p className="text-xs text-slate-400 mt-1">支持修饰键: CommandOrControl, Alt, Shift</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex-1 text-sm text-slate-600">
              当前快捷键：
              <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded ml-1">{hotkey.startStop}</span>
            </div>
            <button onClick={handleSaveHotkey}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors">
              {hotkeySaved ? '已应用 ✓' : '应用'}
            </button>
          </div>
        </div>
      </div>

      {/* Coordinate pick settings */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">坐标选取</h3>
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-sm text-slate-700">选取时自动隐藏主窗口</p>
            <p className="text-xs text-slate-400 mt-0.5">点击「屏幕选取」时先隐藏本窗口，选取完成后自动恢复</p>
          </div>
          <div className="relative ml-4 shrink-0">
            <input type="checkbox" className="sr-only peer"
              checked={settings.hideWindowOnPick}
              onChange={e => onSettingsChange({ ...settings, hideWindowOnPick: e.target.checked })} />
            <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-blue-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
          </div>
        </label>
      </div>

      {/* Check for updates */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">检查更新</h3>
          {version && <span className="text-xs text-slate-400 font-mono">v{version}</span>}
        </div>

        {updateState === 'idle' && (
          <button onClick={handleCheckUpdate}
            className="w-full py-2.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors">
            检查更新
          </button>
        )}

        {updateState === 'checking' && (
          <div className="flex items-center justify-center gap-2 py-2.5 text-sm text-slate-500">
            <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            检查中…
          </div>
        )}

        {updateState === 'latest' && (
          <div className="flex items-center gap-2 py-2 text-sm text-green-600">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            已是最新版本
            <button onClick={() => setUpdateState('idle')} className="ml-auto text-xs text-slate-400 hover:text-slate-600">重新检查</button>
          </div>
        )}

        {updateState === 'available' && releaseInfo && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>发现新版本 <strong>{releaseInfo.tag}</strong></span>
            </div>
            {releaseInfo.notes && (
              <p className="text-xs text-slate-500 bg-slate-50 rounded p-2 line-clamp-3">{releaseInfo.notes}</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setUpdateState('idle')}
                className="flex-1 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                稍后
              </button>
              <button onClick={handleDownload}
                className="flex-1 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors font-medium">
                {releaseInfo.downloadUrl ? '立即下载' : '前往 GitHub 下载'}
              </button>
            </div>
          </div>
        )}

        {/* Download progress */}
        {updateState === 'downloading' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>下载中…</span>
              <span className="font-mono">{downloadPercent}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${downloadPercent}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 text-center">请勿关闭应用</p>
          </div>
        )}

        {/* Download complete */}
        {updateState === 'downloaded' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              下载完成！
            </div>
            <p className="text-xs text-slate-400">
              {window.clickerAPI.platform === 'darwin'
                ? '打开安装包后，将应用拖入 Applications 文件夹完成安装。'
                : '运行安装程序完成更新。'}
            </p>
            <button onClick={handleOpenFile}
              className="w-full py-2.5 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors">
              打开安装包
            </button>
          </div>
        )}

        {updateState === 'error' && (
          <div className="space-y-2">
            <p className="text-xs text-red-500 leading-relaxed">{updateError}</p>
            <button onClick={() => setUpdateState('idle')} className="text-xs text-slate-500 hover:text-blue-500">重试</button>
          </div>
        )}
      </div>

      {/* Auto-save hint */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex gap-2">
          <svg className="w-4 h-4 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-xs text-green-700">
            <p className="font-medium mb-0.5">自动保存已启用</p>
            <p>所有任务配置会在修改后自动保存到本地，下次启动时自动恢复。</p>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">关于</h3>
        <div className="space-y-1 text-xs text-slate-500">
          <p>Mouse Clicker{version ? ` v${version}` : ''}</p>
          <p>一款跨平台鼠标自动点击工具</p>
          <a href="https://github.com/CrazyChenzi/mouse-clicker" target="_blank" rel="noreferrer"
            className="text-blue-500 hover:underline">GitHub</a>
        </div>
      </div>
    </div>
  )
}
