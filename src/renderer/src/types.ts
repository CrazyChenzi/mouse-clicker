export interface ClickAction {
  id: string
  type?: 'coordinate' | 'image'  // default 'coordinate' (backwards-compatible)
  // coordinate type
  x: number
  y: number
  // image type
  imageBase64?: string       // PNG/JPG as base64 data URL
  imageName?: string         // display name (original filename)
  confidence?: number        // match threshold 0–1, default 0.8
  // common
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

export interface AppSettings {
  hideWindowOnPick: boolean  // whether to auto-hide window during coordinate pick
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
  url: string         // GitHub release page
  downloadUrl: string // direct asset download URL for current platform/arch
  publishedAt: string
  notes: string
}
