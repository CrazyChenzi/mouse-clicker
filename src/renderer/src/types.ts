export interface ClickAction {
  id: string
  x: number
  y: number
  infiniteCount?: boolean  // true = keep clicking until manually stopped
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
  repeatCount: number        // 0 = unlimited
  delayBetweenActions: number
  recordedTrajectory?: RecordedPoint[]
}

export interface ScheduleConfig {
  enabled: boolean
  startAt: string | null
  taskIds: string[]
}

export interface HotkeyConfig {
  startStop: string
}

export interface AppSettings {
  hideWindowOnPick: boolean
}

export interface AppData {
  profiles: ClickTask[]
  activeProfileId: string
  settings?: AppSettings
}

export type AppStatus = 'idle' | 'running' | 'scheduled' | string

export interface ReleaseInfo {
  tag: string
  version: string
  url: string
  downloadUrl: string
  publishedAt: string
  notes: string
}