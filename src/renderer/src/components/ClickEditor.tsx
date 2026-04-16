import React from 'react'
import { useState } from 'react'
import { ClickAction } from '../types'

interface Props {
  action: ClickAction
  onSave: (action: ClickAction) => void
  onCancel: () => void
}

export default function ClickEditor({ action: initial, onSave, onCancel }: Props): React.JSX.Element {
  const [action, setAction] = useState<ClickAction>({ ...initial })
  const [picking, setPicking] = useState(false)

  const handlePickCoordinate = async (): Promise<void> => {
    setPicking(true)
    try {
      const coords = await window.clickerAPI.pickCoordinate()
      if (coords) {
        setAction((a) => ({ ...a, x: coords.x, y: coords.y }))
      }
    } finally {
      setPicking(false)
    }
  }

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    onSave(action)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-96 p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-5">
          {initial.x === 0 && initial.y === 0 ? '添加点击动作' : '编辑点击动作'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Coordinate */}
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">点击位置</label>
            <div className="flex gap-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400 font-mono">X</span>
                <input
                  type="number"
                  value={action.x}
                  onChange={(e) => setAction({ ...action, x: parseInt(e.target.value) || 0 })}
                  className="w-24 px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400 font-mono">Y</span>
                <input
                  type="number"
                  value={action.y}
                  onChange={(e) => setAction({ ...action, y: parseInt(e.target.value) || 0 })}
                  className="w-24 px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
              <button
                type="button"
                onClick={handlePickCoordinate}
                disabled={picking}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm rounded transition-colors disabled:opacity-50"
              >
                {picking ? (
                  <>
                    <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    选取中...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                    </svg>
                    屏幕选取
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Mouse button */}
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">鼠标按键</label>
            <div className="flex gap-2">
              {(['left', 'right', 'middle'] as const).map((btn) => (
                <button
                  key={btn}
                  type="button"
                  onClick={() => setAction({ ...action, button: btn })}
                  className={`flex-1 py-1.5 text-sm rounded border transition-colors ${
                    action.button === btn
                      ? 'border-blue-500 bg-blue-50 text-blue-600 font-medium'
                      : 'border-slate-300 text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {btn === 'left' ? '左键' : btn === 'right' ? '右键' : '中键'}
                </button>
              ))}
            </div>
          </div>

          {/* Click count */}
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">
              点击次数
              <span className="text-slate-400 ml-1 text-xs">（单次/双击/多次）</span>
            </label>
            <input
              type="number"
              min={1}
              max={99}
              value={action.count}
              onChange={(e) =>
                setAction({ ...action, count: Math.max(1, parseInt(e.target.value) || 1) })
              }
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Delay between clicks */}
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">
              点击间隔
              <span className="text-slate-400 ml-1 text-xs">（毫秒，多次点击时生效）</span>
            </label>
            <input
              type="number"
              min={0}
              step={50}
              value={action.delayBetweenClicks}
              onChange={(e) =>
                setAction({
                  ...action,
                  delayBetweenClicks: Math.max(0, parseInt(e.target.value) || 0)
                })
              }
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">备注（可选）</label>
            <input
              type="text"
              value={action.description || ''}
              onChange={(e) => setAction({ ...action, description: e.target.value })}
              placeholder="给这个点击动作添加备注..."
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors font-medium"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
