import React from 'react'
import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { ClickAction, RecordedPoint } from '../types'

interface Props {
  onAddActions: (actions: ClickAction[]) => void
}

function recordedToActions(points: RecordedPoint[]): ClickAction[] {
  if (points.length === 0) return []
  // Cluster nearby points and convert to click actions
  // Simple approach: take click points, or sample every Nth movement point
  const clicks = points.filter((p) => p.isClick)
  if (clicks.length > 0) {
    return clicks.map((p) => ({
      id: uuidv4(),
      x: p.x,
      y: p.y,
      count: 1,
      delayBetweenClicks: 100,
      button: 'left' as const,
      description: `录制 (${p.x}, ${p.y})`
    }))
  }
  // If no click events, sample movement every 500ms
  const sampled: RecordedPoint[] = []
  let lastTime = 0
  for (const p of points) {
    if (p.timestamp - lastTime >= 500) {
      sampled.push(p)
      lastTime = p.timestamp
    }
  }
  return sampled.map((p) => ({
    id: uuidv4(),
    x: p.x,
    y: p.y,
    count: 1,
    delayBetweenClicks: 100,
    button: 'left' as const,
    description: `录制 (${p.x}, ${p.y})`
  }))
}

export default function Recorder({ onAddActions }: Props): React.JSX.Element {
  const [isRecording, setIsRecording] = useState(false)
  const [points, setPoints] = useState<RecordedPoint[]>([])
  const [converted, setConverted] = useState<ClickAction[] | null>(null)

  const handleStartStop = async (): Promise<void> => {
    if (isRecording) {
      const res = await window.clickerAPI.stopRecording()
      setIsRecording(false)
      setPoints(res.points)
      setConverted(null)
    } else {
      await window.clickerAPI.startRecording()
      setIsRecording(true)
      setPoints([])
      setConverted(null)
    }
  }

  const handleConvert = (): void => {
    const actions = recordedToActions(points)
    setConverted(actions)
  }

  const handleAdd = (): void => {
    if (converted && converted.length > 0) {
      onAddActions(converted)
      setConverted(null)
      setPoints([])
    }
  }

  const handleClear = (): void => {
    setPoints([])
    setConverted(null)
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Recording controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">鼠标轨迹录制</h3>
        <p className="text-xs text-slate-500 mb-4">
          开始录制后，移动鼠标执行操作；停止后可将轨迹转为点击动作序列。
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleStartStop}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isRecording ? (
              <>
                <span className="w-3 h-3 bg-white rounded-sm" />
                停止录制
              </>
            ) : (
              <>
                <span className="w-3 h-3 bg-white rounded-full" />
                开始录制
              </>
            )}
          </button>

          {isRecording && (
            <div className="flex items-center gap-2 text-sm text-red-500">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              录制中...
            </div>
          )}
        </div>
      </div>

      {/* Recorded points info */}
      {points.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">录制结果</h3>
            <button
              onClick={handleClear}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors"
            >
              清除
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-slate-700">{points.length}</div>
              <div className="text-xs text-slate-500 mt-0.5">轨迹点</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-slate-700">
                {points.length > 0
                  ? ((points[points.length - 1].timestamp - points[0].timestamp) / 1000).toFixed(1)
                  : 0}
                s
              </div>
              <div className="text-xs text-slate-500 mt-0.5">录制时长</div>
            </div>
          </div>

          {!converted ? (
            <button
              onClick={handleConvert}
              className="w-full py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm rounded-lg transition-colors"
            >
              转换为点击动作序列
            </button>
          ) : (
            <div>
              <div className="text-xs text-slate-500 mb-3">
                已转换为 <span className="font-semibold text-slate-700">{converted.length}</span> 个点击动作
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 mb-3">
                {converted.map((a, i) => (
                  <div key={a.id} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded px-2 py-1">
                    <span className="text-slate-400">{i + 1}.</span>
                    <span className="font-mono">({a.x}, {a.y})</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConverted(null)}
                  className="flex-1 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  重新转换
                </button>
                <button
                  onClick={handleAdd}
                  className="flex-1 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors font-medium"
                >
                  添加到动作列表
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {points.length === 0 && !isRecording && (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
            <p className="text-sm">点击「开始录制」后移动鼠标</p>
          </div>
        </div>
      )}
    </div>
  )
}
