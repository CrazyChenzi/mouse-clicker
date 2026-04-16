export interface ClickAction {
  id: string
  x: number
  y: number
  count: number
  delayBetweenClicks: number
  button: 'left' | 'right' | 'middle'
  description?: string
}

export interface RecordedPoint {
  x: number
  y: number
  timestamp: number
  isClick: boolean
}

export interface ClickTask {
  id: string
  name: string
  actions: ClickAction[]
  repeatCount: number
  delayBetweenActions: number
  recordedTrajectory?: RecordedPoint[]
}

export interface ScheduleConfig {
  enabled: boolean
  startAt: string | null
  taskIds: string[]   // tasks to run in sequence
}

export interface HotkeyConfig {
  startStop: string
}

export interface AppData {
  profiles: ClickTask[]
  activeProfileId: string
}

export type AppStatus = 'idle' | 'running' | 'scheduled' | string
