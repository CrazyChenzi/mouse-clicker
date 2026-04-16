import React from 'react'
import { AppStatus } from '../types'

interface Props {
  status: AppStatus
  actionCount: number
  profileName?: string
  onStart: () => void
  onStop: () => void
  hotkey: string
}

export default function Controls({ status, actionCount, profileName, onStart, onStop, hotkey }: Props): React.JSX.Element {
  const isRunning = status === 'running'
  const isScheduled = status === 'scheduled'
  const isIdle = !isRunning && !isScheduled

  const statusColor = isRunning ? 'bg-green-500' : isScheduled ? 'bg-blue-500' : 'bg-slate-300'
  const statusText = isRunning ? '执行中' : isScheduled ? '定时等待' : '就绪'

  return (
    <div className="bg-white border-t border-slate-200 px-4 py-3 flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${statusColor} ${isRunning ? 'animate-pulse' : ''}`} />
        <span className="text-xs text-slate-500">{statusText}</span>
      </div>

      <div className="text-xs text-slate-400">
        {profileName && <span className="font-medium text-slate-600">{profileName}</span>}
        {profileName && ' · '}
        {actionCount} 个动作
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-slate-400 hidden sm:block">
          快捷键:{' '}
          <kbd className="font-mono bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-slate-600">
            {hotkey}
          </kbd>
        </span>

        {!isIdle && (
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
            停止
          </button>
        )}

        {isIdle && (
          <button
            onClick={onStart}
            disabled={actionCount === 0}
            className="flex items-center gap-1.5 px-5 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            立即启动
          </button>
        )}
      </div>
    </div>
  )
}
