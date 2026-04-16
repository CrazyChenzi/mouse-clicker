import React, { useState } from 'react'
import { HotkeyConfig } from '../types'

interface Props {
  hotkey: HotkeyConfig
  onSaveHotkey: (config: HotkeyConfig) => void
}

const PRESET_KEYS = ['F6', 'F7', 'F8', 'F9', 'F10', 'F12']

export default function Settings({ hotkey, onSaveHotkey }: Props): React.JSX.Element {
  const [key, setKey] = useState(hotkey.startStop)
  const [customKey, setCustomKey] = useState('')
  const [hotkeyMode, setHotkeyMode] = useState<'preset' | 'custom'>(
    PRESET_KEYS.includes(hotkey.startStop) ? 'preset' : 'custom'
  )
  const [hotkeySaved, setHotkeySaved] = useState(false)

  const handleSaveHotkey = async (): Promise<void> => {
    const k = hotkeyMode === 'preset' ? key : customKey
    if (!k) return
    await onSaveHotkey({ startStop: k })
    setHotkeySaved(true)
    setTimeout(() => setHotkeySaved(false), 2000)
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
      {/* Hotkey settings */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">全局快捷键</h3>
        <p className="text-xs text-slate-500 mb-4">
          设置一个全局快捷键，在任意应用中按下即可启动/停止点击任务。
        </p>

        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setHotkeyMode('preset')}
              className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${
                hotkeyMode === 'preset' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-600'
              }`}
            >
              预设按键
            </button>
            <button
              onClick={() => setHotkeyMode('custom')}
              className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${
                hotkeyMode === 'custom' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-600'
              }`}
            >
              自定义
            </button>
          </div>

          {hotkeyMode === 'preset' ? (
            <div className="grid grid-cols-3 gap-2">
              {PRESET_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => setKey(k)}
                  className={`py-2 text-sm font-mono rounded-lg border transition-colors ${
                    key === k ? 'border-blue-500 bg-blue-50 text-blue-600 font-semibold' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          ) : (
            <div>
              <input
                type="text"
                value={customKey}
                onChange={e => setCustomKey(e.target.value)}
                placeholder="例如: CommandOrControl+Shift+S"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <p className="text-xs text-slate-400 mt-1">
                支持修饰键: CommandOrControl, Alt, Shift，组合示例: Alt+F8
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex-1 text-sm text-slate-600">
              当前快捷键：
              <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded ml-1">
                {hotkey.startStop}
              </span>
            </div>
            <button
              onClick={handleSaveHotkey}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
            >
              {hotkeySaved ? '已应用 ✓' : '应用'}
            </button>
          </div>
        </div>
      </div>

      {/* Auto-save hint */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex gap-2">
          <svg className="w-4 h-4 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-xs text-green-700">
            <p className="font-medium mb-0.5">自动保存已启用</p>
            <p>所有任务配置会在修改后自动保存到本地，下次启动时自动恢复。标题栏会显示「已保存」提示。</p>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">关于</h3>
        <div className="space-y-1 text-xs text-slate-500">
          <p>Mouse Clicker v1.0.0</p>
          <p>一款跨平台鼠标自动点击工具</p>
        </div>
      </div>
    </div>
  )
}
