import * as schedule from 'node-schedule'
import { ClickTask, ScheduleConfig } from '../renderer/src/types'
import { executeTask } from './autoClicker'

let currentJob: schedule.Job | null = null

export function scheduleTask(
  config: ScheduleConfig,
  tasks: ClickTask[],
  onStart?: () => void,
  onProgress?: (info: { action: number; repeat: number }) => void,
  onFinish?: () => void
): boolean {
  cancelSchedule()

  if (!config.enabled || !config.startAt || tasks.length === 0) return false

  const startDate = new Date(config.startAt)
  if (isNaN(startDate.getTime()) || startDate <= new Date()) return false

  currentJob = schedule.scheduleJob(startDate, async () => {
    onStart?.()
    for (const task of tasks) {
      await executeTask(task, onProgress)
    }
    onFinish?.()
    currentJob = null
  })

  return currentJob !== null
}

export function cancelSchedule(): void {
  if (currentJob) {
    currentJob.cancel()
    currentJob = null
  }
}

export function isScheduled(): boolean {
  return currentJob !== null
}
