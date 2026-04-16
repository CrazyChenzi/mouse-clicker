import React, { useState, useEffect } from 'react'
import { DatePicker, Select, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs, { Dayjs } from 'dayjs'
import 'dayjs/locale/zh-cn'
import { ScheduleConfig, ClickTask, AppStatus } from '../types'

dayjs.locale('zh-cn')

interface Props {
  config: ScheduleConfig
  profiles: ClickTask[]
  onSave: (config: ScheduleConfig) => void
  status: AppStatus
}

export default function Scheduler({ config, profiles, onSave, status }: Props): React.JSX.Element {
  const [enabled, setEnabled] = useState(config.enabled)
  const [startAt, setStartAt] = useState<Dayjs | null>(
    config.startAt ? dayjs(config.startAt) : null
  )
  const [taskIds, setTaskIds] = useState<string[]>(config.taskIds ?? [])
  const [saved, setSaved] = useState(false)

  // Sync props → local state when config reloads from disk or changes externally
  useEffect(() => {
    setEnabled(config.enabled)
    setStartAt(config.startAt ? dayjs(config.startAt) : null)
    setTaskIds(config.taskIds ?? [])
  }, [config])

  const isScheduled = status === 'scheduled'
  const isRunning = status === 'running'
  const disabled = isRunning || isScheduled

  const handleSave = (): void => {
    onSave({ enabled, startAt: startAt ? startAt.toISOString() : null, taskIds })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleCancel = (): void => {
    setEnabled(false)
    onSave({ enabled: false, startAt: null, taskIds })
  }

  const selectedTasks = taskIds
    .map(id => profiles.find(p => p.id === id))
    .filter((p): p is ClickTask => p !== undefined)

  const totalActions = selectedTasks.reduce((sum, t) => sum + t.actions.length, 0)

  return (
    <ConfigProvider locale={zhCN}>
      <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
        {/* Main card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">定时自动启动</h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={e => setEnabled(e.target.checked)}
                disabled={isRunning}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
            </label>
          </div>

          {enabled && (
            <div className="space-y-4">
              {/* Multi-task selector */}
              <div>
                <label className="block text-sm text-slate-600 mb-1.5">
                  执行哪些任务
                  <span className="text-slate-400 ml-1 text-xs">（可多选，按顺序串行执行）</span>
                </label>
                <Select
                  mode="multiple"
                  value={taskIds}
                  onChange={setTaskIds}
                  disabled={disabled}
                  className="w-full"
                  size="middle"
                  placeholder="选择要执行的任务..."
                  options={profiles.map(p => ({
                    value: p.id,
                    label: `${p.name}（${p.actions.length} 个动作）`
                  }))}
                  maxTagCount={3}
                  maxTagPlaceholder={omitted => `+${omitted.length} 个`}
                />
                {selectedTasks.length > 0 && (
                  <p className="text-xs text-slate-400 mt-1.5">
                    共 {selectedTasks.length} 个任务 · {totalActions} 个动作
                    {selectedTasks.length > 1 && (
                      <span className="ml-1 text-slate-300">
                        （{selectedTasks.map(t => t.name).join(' → ')}）
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Date time picker — seconds precision, popup opens upward */}
              <div>
                <label className="block text-sm text-slate-600 mb-1.5">启动时间</label>
                <DatePicker
                  showTime={{ format: 'HH:mm:ss', defaultValue: dayjs('00:00:00', 'HH:mm:ss') }}
                  value={startAt}
                  onChange={v => setStartAt(v)}
                  disabled={disabled}
                  className="w-full"
                  placeholder="选择日期和时间（精确到秒）"
                  disabledDate={current => current && current < dayjs().startOf('day')}
                  format="YYYY-MM-DD HH:mm:ss"
                  placement="topLeft"
                />
              </div>
            </div>
          )}
        </div>

        {/* Scheduled status */}
        {isScheduled && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-blue-700">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium">定时任务等待中</span>
            </div>
            {config.startAt && (
              <p className="text-xs text-blue-600 mt-1.5 ml-4">
                {dayjs(config.startAt).format('YYYY-MM-DD HH:mm:ss')} 启动{' '}
                {config.taskIds.length > 0
                  ? config.taskIds.map(id => profiles.find(p => p.id === id)?.name).filter(Boolean).join(' → ')
                  : '未知任务'}
              </p>
            )}
            <button
              onClick={handleCancel}
              className="mt-3 text-xs text-blue-600 hover:text-blue-800 underline"
            >
              取消定时任务
            </button>
          </div>
        )}

        {/* Save button */}
        {!isScheduled && enabled && (
          <button
            onClick={handleSave}
            disabled={isRunning || !startAt || taskIds.length === 0}
            className="w-full py-2.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {saved ? '已保存 ✓' : '确认定时启动'}
          </button>
        )}

        {/* Hint */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex gap-2">
            <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs text-amber-700">
              <p className="font-medium mb-0.5">使用提示</p>
              <p>多任务将按选择顺序串行执行。应用需保持运行到指定时间才会触发。</p>
            </div>
          </div>
        </div>
      </div>
    </ConfigProvider>
  )
}
