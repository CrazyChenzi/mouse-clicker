import React from 'react'
import { useState } from 'react'
import { ClickAction } from '../types'

interface Props {
  action: ClickAction
  hideOnPick: boolean
  onSave: (action: ClickAction) => void
  onCancel: () => void
}

export default function ClickEditor({ action: initial, hideOnPick, onSave, onCancel }: Props): React.JSX.Element {
  const [action, setAction] = useState<ClickAction>({ type: 'coordinate', ...initial })
  const [picking, setPicking] = useState(false)
  const [imageLoading, setImageLoading] = useState(false)

  const isImage = action.type === 'image'

  const handlePickCoordinate = async (): Promise<void> => {
    setPicking(true)
    if (hideOnPick) await window.clickerAPI.hideWindow()
    try {
      const coords = await window.clickerAPI.pickCoordinate()
      if (coords) setAction((a) => ({ ...a, x: coords.x, y: coords.y }))
    } finally {
      // Always restore focus, even when hideOnPick=false (picker may lower z-order)
      await window.clickerAPI.showWindow()
      setPicking(false)
    }
  }

  const handlePickImage = async (): Promise<void> => {
    setImageLoading(true)
    try {
      const res = await window.clickerAPI.pickImage()
      if (res.ok && res.base64) {
        setAction(a => ({ ...a, type: 'image', imageBase64: res.base64, imageName: res.name }))
      }
    } finally {
      setImageLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    onSave(action)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[420px] p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-base font-semibold text-slate-800 mb-5">
          {initial.imageBase64 || (initial.x === 0 && initial.y === 0) ? '编辑点击动作' : '编辑点击动作'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Action type switcher */}
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">动作类型</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAction(a => ({ ...a, type: 'coordinate' }))}
                className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${
                  !isImage ? 'border-blue-500 bg-blue-50 text-blue-600 font-medium' : 'border-slate-300 text-slate-600'
                }`}
              >
                坐标点击
              </button>
              <button
                type="button"
                onClick={() => setAction(a => ({ ...a, type: 'image' }))}
                className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${
                  isImage ? 'border-blue-500 bg-blue-50 text-blue-600 font-medium' : 'border-slate-300 text-slate-600'
                }`}
              >
                图片识别
              </button>
            </div>
          </div>

          {/* Coordinate type */}
          {!isImage && (
            <div>
              <label className="block text-sm text-slate-600 mb-1.5">点击位置</label>
              <div className="flex gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400 font-mono">X</span>
                  <input type="number" value={action.x}
                    onChange={e => setAction({ ...action, x: parseInt(e.target.value) || 0 })}
                    className="w-24 px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400 font-mono">Y</span>
                  <input type="number" value={action.y}
                    onChange={e => setAction({ ...action, y: parseInt(e.target.value) || 0 })}
                    className="w-24 px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0" />
                </div>
                <button type="button" onClick={handlePickCoordinate} disabled={picking}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm rounded transition-colors disabled:opacity-50">
                  {picking ? (
                    <><span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />选取中…</>
                  ) : (
                    <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" /></svg>屏幕选取</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Image type */}
          {isImage && (
            <>
              <div>
                <label className="block text-sm text-slate-600 mb-1.5">参考图片</label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center">
                  {action.imageBase64 ? (
                    <div className="space-y-2">
                      <img
                        src={action.imageBase64}
                        alt="template"
                        className="max-h-24 max-w-full mx-auto rounded shadow-sm object-contain"
                      />
                      <p className="text-xs text-slate-500 truncate">{action.imageName}</p>
                      <button type="button" onClick={handlePickImage} disabled={imageLoading}
                        className="text-xs text-blue-500 hover:text-blue-700">
                        重新选择
                      </button>
                    </div>
                  ) : (
                    <div>
                      <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <button type="button" onClick={handlePickImage} disabled={imageLoading}
                        className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg">
                        {imageLoading ? '读取中…' : '选择图片'}
                      </button>
                      <p className="text-xs text-slate-400 mt-2">支持 PNG、JPG 格式</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">
                  匹配置信度
                  <span className="text-slate-400 ml-2 text-xs">{Math.round((action.confidence ?? 0.8) * 100)}%</span>
                </label>
                <input type="range" min={50} max={99} step={1}
                  value={Math.round((action.confidence ?? 0.8) * 100)}
                  onChange={e => setAction(a => ({ ...a, confidence: parseInt(e.target.value) / 100 }))}
                  className="w-full accent-blue-500" />
                <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                  <span>宽松 50%</span><span>严格 99%</span>
                </div>
              </div>
            </>
          )}

          {/* Mouse button */}
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">鼠标按键</label>
            <div className="flex gap-2">
              {(['left', 'right', 'middle'] as const).map(btn => (
                <button key={btn} type="button" onClick={() => setAction({ ...action, button: btn })}
                  className={`flex-1 py-1.5 text-sm rounded border transition-colors ${
                    action.button === btn ? 'border-blue-500 bg-blue-50 text-blue-600 font-medium' : 'border-slate-300 text-slate-600 hover:border-slate-400'
                  }`}>
                  {btn === 'left' ? '左键' : btn === 'right' ? '右键' : '中键'}
                </button>
              ))}
            </div>
          </div>

          {/* Click count & delay */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1.5">点击次数</label>
              <input type="number" min={1} max={99} value={action.count}
                onChange={e => setAction({ ...action, count: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1.5">点击间隔 (ms)</label>
              <input type="number" min={0} step={50} value={action.delayBetweenClicks}
                onChange={e => setAction({ ...action, delayBetweenClicks: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">备注（可选）</label>
            <input type="text" value={action.description || ''}
              onChange={e => setAction({ ...action, description: e.target.value })}
              placeholder="给这个点击动作添加备注…"
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel}
              className="flex-1 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              取消
            </button>
            <button type="submit"
              disabled={isImage && !action.imageBase64}
              className="flex-1 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors font-medium disabled:opacity-40">
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
