import React, { useState } from 'react'
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
  const [captureError, setCaptureError] = useState('')
  const [ocrState, setOcrState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [ocrText, setOcrText] = useState(initial.ocrText ?? '')

  const isImage = action.type === 'image'

  // ── Run OCR on a base64 image ─────────────────────────────────────────────
  const runOcr = async (base64: string): Promise<void> => {
    setOcrState('running')
    try {
      const res = await window.clickerAPI.recognizeText(base64)
      if (res.ok && res.text) {
        setOcrText(res.text)
        setAction(a => ({ ...a, ocrText: res.text }))
        setOcrState('done')
      } else {
        setOcrState(res.text === '' ? 'done' : 'error')  // 'done' with empty = no text found
      }
    } catch {
      setOcrState('error')
    }
  }

  // ── Coordinate pick ──────────────────────────────────────────────────────
  const handlePickCoordinate = async (): Promise<void> => {
    setPicking(true)
    if (hideOnPick) await window.clickerAPI.hideWindow()
    try {
      const coords = await window.clickerAPI.pickCoordinate()
      if (coords) setAction(a => ({ ...a, x: coords.x, y: coords.y }))
    } finally {
      await window.clickerAPI.showWindow()
      setPicking(false)
    }
  }

  // ── Import image file ─────────────────────────────────────────────────────
  const handlePickImage = async (): Promise<void> => {
    setImageLoading(true)
    setCaptureError('')
    try {
      const res = await window.clickerAPI.pickImage()
      if (res.ok && res.base64) {
        setAction(a => ({ ...a, type: 'image', imageBase64: res.base64, imageName: res.name, ocrText: undefined }))
        setOcrText('')
        setOcrState('idle')
        await runOcr(res.base64)
      }
    } finally {
      setImageLoading(false)
    }
  }

  // ── Screen region capture ─────────────────────────────────────────────────
  const handleCaptureRegion = async (): Promise<void> => {
    setImageLoading(true)
    setCaptureError('')
    // Always hide window so the screen is clean for selection,
    // regardless of hideOnPick setting
    await window.clickerAPI.hideWindow()
    try {
      const res = await window.clickerAPI.captureRegion()
      if (res.ok && res.base64) {
        setAction(a => ({
          ...a,
          type: 'image',
          imageBase64: res.base64,
          imageName: `capture-${res.centerX},${res.centerY}.png`,
          captureX: res.centerX,
          captureY: res.centerY,
          x: res.centerX ?? a.x,
          y: res.centerY ?? a.y,
          ocrText: undefined
        }))
        setOcrText('')
        setOcrState('idle')
        await runOcr(res.base64)
      } else {
        setCaptureError(res.error ?? '截取失败，请检查屏幕录制权限（系统设置 → 隐私与安全性 → 屏幕录制）')
      }
    } finally {
      await window.clickerAPI.showWindow()
      setImageLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    onSave({ ...action, ocrText: ocrText || undefined })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[440px] p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-base font-semibold text-slate-800 mb-5">编辑点击动作</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Action type switcher */}
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">动作类型</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAction(a => ({ ...a, type: 'coordinate' }))}
                className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${!isImage ? 'border-blue-500 bg-blue-50 text-blue-600 font-medium' : 'border-slate-300 text-slate-600'}`}>
                坐标点击
              </button>
              <button type="button" onClick={() => setAction(a => ({ ...a, type: 'image' }))}
                className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${isImage ? 'border-blue-500 bg-blue-50 text-blue-600 font-medium' : 'border-slate-300 text-slate-600'}`}>
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
                    className="w-24 px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400 font-mono">Y</span>
                  <input type="number" value={action.y}
                    onChange={e => setAction({ ...action, y: parseInt(e.target.value) || 0 })}
                    className="w-24 px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <button type="button" onClick={handlePickCoordinate} disabled={picking}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm rounded transition-colors disabled:opacity-50">
                  {picking ? <><span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />选取中…</> : <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                    </svg>屏幕选取</>}
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
                    <div className="space-y-3">
                      <img src={action.imageBase64} alt="template"
                        className="max-h-28 max-w-full mx-auto rounded shadow-sm object-contain border border-slate-200" />
                      {(action.captureX !== undefined) && (
                        <div className="bg-slate-50 rounded-lg px-3 py-1.5 flex items-center gap-3 text-xs">
                          <svg className="w-3.5 h-3.5 text-purple-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="text-slate-500">截取位置</span>
                          <span className="font-mono text-slate-700 font-medium">({action.captureX}, {action.captureY})</span>
                        </div>
                      )}
                      <div className="flex items-center justify-center gap-3">
                        <button type="button" onClick={handlePickImage} disabled={imageLoading}
                          className="text-xs text-blue-500 hover:text-blue-700">重新导入</button>
                        <span className="text-slate-300">|</span>
                        <button type="button" onClick={handleCaptureRegion} disabled={imageLoading}
                          className="text-xs text-purple-500 hover:text-purple-700">重新截取</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <svg className="w-8 h-8 text-slate-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div className="flex gap-2 justify-center">
                        <button type="button" onClick={handleCaptureRegion} disabled={imageLoading}
                          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-purple-500 hover:bg-purple-600 text-white rounded-lg disabled:opacity-50">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                          </svg>
                          {imageLoading ? '截取中…' : '截取屏幕'}
                        </button>
                        <button type="button" onClick={handlePickImage} disabled={imageLoading}
                          className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50">
                          导入图片
                        </button>
                      </div>
                      <p className="text-xs text-slate-400">截取屏幕区域 或 导入 PNG/JPG</p>
                    </div>
                  )}
                </div>

                {/* Capture error */}
                {captureError && (
                  <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-600 leading-relaxed">{captureError}</p>
                  </div>
                )}
              </div>

              {/* OCR result */}
              {action.imageBase64 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm text-slate-600">识别到的文字</label>
                    {ocrState === 'running' && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <span className="w-3 h-3 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                        识别中…
                      </span>
                    )}
                    {ocrState === 'done' && ocrText && (
                      <span className="text-xs text-green-500">✓ 识别完成</span>
                    )}
                    {ocrState === 'done' && !ocrText && (
                      <span className="text-xs text-slate-400">未检测到文字</span>
                    )}
                    {action.imageBase64 && ocrState !== 'running' && (
                      <button type="button" onClick={() => runOcr(action.imageBase64!)}
                        className="text-xs text-blue-500 hover:text-blue-700">重新识别</button>
                    )}
                  </div>
                  <textarea
                    value={ocrText}
                    onChange={e => { setOcrText(e.target.value); setAction(a => ({ ...a, ocrText: e.target.value })) }}
                    placeholder={ocrState === 'running' ? '识别中…' : '识别到的文字将显示在这里，可手动修改'}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-slate-700"
                  />
                  <p className="text-xs text-slate-400 mt-0.5">可用于备注识别内容，不影响图片匹配逻辑</p>
                </div>
              )}

              {/* Confidence */}
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
                  className={`flex-1 py-1.5 text-sm rounded border transition-colors ${action.button === btn ? 'border-blue-500 bg-blue-50 text-blue-600 font-medium' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}>
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
