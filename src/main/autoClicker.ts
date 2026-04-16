import { ClickTask } from '../renderer/src/types'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const robot = require('robotjs')

let isRunning = false
let shouldStop = false
let runCount = 0

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function executeTask(
  task: ClickTask,
  onProgress?: (info: { action: number; repeat: number }) => void
): Promise<void> {
  if (isRunning) return
  isRunning = true
  shouldStop = false
  runCount = 0

  const { actions, repeatCount, delayBetweenActions } = task
  const maxRepeats = repeatCount === 0 ? Infinity : repeatCount

  try {
    while (runCount < maxRepeats && !shouldStop) {
      runCount++
      for (let i = 0; i < actions.length; i++) {
        if (shouldStop) break
        const action = actions[i]

        try {
          robot.moveMouse(action.x, action.y)
          await sleep(50)

          for (let c = 0; c < action.count; c++) {
            if (shouldStop) break
            robot.mouseClick(action.button, false)
            if (c < action.count - 1) {
              await sleep(action.delayBetweenClicks)
            }
          }
        } catch (robotErr) {
          console.error('[autoClicker] robotjs error:', robotErr)
          // Stop the task if robotjs fails (e.g. accessibility permission revoked)
          shouldStop = true
          break
        }

        if (onProgress) {
          onProgress({ action: i, repeat: runCount })
        }

        if (i < actions.length - 1 && !shouldStop) {
          await sleep(delayBetweenActions)
        }
      }

      if (runCount < maxRepeats && !shouldStop && actions.length > 0) {
        await sleep(delayBetweenActions)
      }
    }
  } finally {
    isRunning = false
    shouldStop = false
  }
}

export function stopTask(): void {
  shouldStop = true
}

export function getIsRunning(): boolean {
  return isRunning
}

export function getRunCount(): number {
  return runCount
}
