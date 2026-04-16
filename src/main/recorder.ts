import { RecordedPoint } from '../renderer/src/types'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const robot = require('robotjs')

let isRecording = false
let recordedPoints: RecordedPoint[] = []
let pollInterval: ReturnType<typeof setInterval> | null = null
let lastPos = { x: -1, y: -1 }
const POLL_MS = 50

export function startRecording(): void {
  if (isRecording) return
  isRecording = true
  recordedPoints = []
  lastPos = { x: -1, y: -1 }

  pollInterval = setInterval(() => {
    const pos = robot.getMousePos() as { x: number; y: number }
    if (pos.x !== lastPos.x || pos.y !== lastPos.y) {
      recordedPoints.push({
        x: pos.x,
        y: pos.y,
        timestamp: Date.now(),
        isClick: false
      })
      lastPos = { x: pos.x, y: pos.y }
    }
  }, POLL_MS)
}

export function stopRecording(): RecordedPoint[] {
  if (!isRecording) return []
  isRecording = false
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  return [...recordedPoints]
}

export function getIsRecording(): boolean {
  return isRecording
}

export function getRecordedPoints(): RecordedPoint[] {
  return [...recordedPoints]
}
