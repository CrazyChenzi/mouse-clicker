import {
  IpcMain,
  BrowserWindow,
  globalShortcut,
  screen,
  app
} from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import * as path from 'path'
import { executeTask, stopTask, getIsRunning } from './autoClicker'
import { startRecording, stopRecording } from './recorder'
import { scheduleTask, cancelSchedule, isScheduled } from './scheduler'
import { checkForUpdates } from './updater'
import { ClickTask, HotkeyConfig, ScheduleConfig, AppData } from '../renderer/src/types'

const PROFILES_FILE = path.join(app.getPath('userData'), 'profiles.json')

let currentHotkey = 'F8'
let pickerWindow: BrowserWindow | null = null

function sendStatus(getMainWindow: () => BrowserWindow | null, status: string): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('status:change', status)
  }
}

async function executeTasksInSequence(
  tasks: ClickTask[],
  onProgress: (info: { action: number; repeat: number }) => void
): Promise<void> {
  for (const task of tasks) {
    await executeTask(task, onProgress)
  }
}

function toggleTask(tasks: ClickTask[], getMainWindow: () => BrowserWindow | null): void {
  if (getIsRunning()) {
    stopTask()
    sendStatus(getMainWindow, 'idle')
  } else if (tasks.length > 0) {
    sendStatus(getMainWindow, 'running')
    executeTasksInSequence(tasks, (info) => {
      sendStatus(getMainWindow, `running:${info.action}:${info.repeat}`)
    }).then(() => {
      sendStatus(getMainWindow, 'idle')
    }).catch((err) => {
      console.error('[ipc] toggleTask error:', err)
      sendStatus(getMainWindow, 'idle')
    })
  }
}

let lastTasks: ClickTask[] = []

export function registerIpcHandlers(
  ipcMain: IpcMain,
  getMainWindow: () => BrowserWindow | null
): void {
  // Renderer notifies main process of the currently active task (for hotkey use)
  ipcMain.handle('task:setActive', async (_event, task: ClickTask) => {
    lastTasks = [task]
    return { ok: true }
  })

  // Start single task execution
  ipcMain.handle('clicker:start', async (_event, task: ClickTask) => {
    lastTasks = [task]
    if (getIsRunning()) return { ok: false, error: 'Already running' }
    sendStatus(getMainWindow, 'running')
    executeTask(task, (info) => {
      sendStatus(getMainWindow, `running:${info.action}:${info.repeat}`)
    }).then(() => {
      sendStatus(getMainWindow, 'idle')
    }).catch((err) => {
      console.error('[ipc] clicker:start error:', err)
      sendStatus(getMainWindow, 'idle')
    })
    return { ok: true }
  })

  // Stop task
  ipcMain.handle('clicker:stop', async () => {
    stopTask()
    sendStatus(getMainWindow, 'idle')
    return { ok: true }
  })

  // Start recording
  ipcMain.handle('recording:start', async () => {
    startRecording()
    return { ok: true }
  })

  // Stop recording and return recorded points
  ipcMain.handle('recording:stop', async () => {
    const points = stopRecording()
    return { ok: true, points }
  })

  // Schedule task(s) — receives config + array of tasks to run in sequence
  ipcMain.handle('schedule:set', async (_event, config: ScheduleConfig, tasks: ClickTask[]) => {
    lastTasks = tasks
    const ok = scheduleTask(
      config,
      tasks,
      () => sendStatus(getMainWindow, 'running'),
      (info) => sendStatus(getMainWindow, `running:${info.action}:${info.repeat}`),
      () => sendStatus(getMainWindow, 'idle')
    )
    if (ok) sendStatus(getMainWindow, 'scheduled')
    return { ok }
  })

  // Cancel schedule
  ipcMain.handle('schedule:cancel', async () => {
    cancelSchedule()
    sendStatus(getMainWindow, 'idle')
    return { ok: true }
  })

  // Register global hotkey
  ipcMain.handle('hotkey:register', async (_event, config: HotkeyConfig) => {
    try {
      globalShortcut.unregister(currentHotkey)
      currentHotkey = config.startStop
      globalShortcut.register(currentHotkey, () => {
        toggleTask(lastTasks, getMainWindow)
      })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  // Default hotkey F8
  globalShortcut.register('F8', () => {
    toggleTask(lastTasks, getMainWindow)
  })

  // ── Coordinate picker ────────────────────────────────────────────────────
  ipcMain.handle('screen:pick', async () => {
    return new Promise<{ x: number; y: number } | null>((resolve) => {
      // Use full display bounds including menu bar area
      const display = screen.getPrimaryDisplay()
      const { x: dx, y: dy, width, height } = display.bounds

      pickerWindow = new BrowserWindow({
        x: dx,
        y: dy,
        width,
        height,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        movable: false,
        skipTaskbar: true,
        hasShadow: false,
        webPreferences: {
          preload: join(__dirname, '../preload/index.js'),
          sandbox: false,
          contextIsolation: true
        }
      })

      pickerWindow.setIgnoreMouseEvents(false)
      pickerWindow.setAlwaysOnTop(true, 'screen-saver')
      pickerWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

      if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
        pickerWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/picker.html')
      } else {
        pickerWindow.loadFile(join(__dirname, '../renderer/picker.html'))
      }

      // Focus the picker window so it can capture keyboard events (e.g. ESC)
      pickerWindow.once('ready-to-show', () => {
        pickerWindow?.show()
        pickerWindow?.focus()
      })

      const cleanup = (): void => {
        if (pickerWindow && !pickerWindow.isDestroyed()) {
          pickerWindow.close()
          pickerWindow = null
        }
        // Remove the other listener to prevent leaks when window closes externally
        ipcMain.removeListener('picker:picked', onPicked)
        ipcMain.removeListener('picker:cancel', onCancel)
      }

      const onPicked = (): void => {
        const pt = screen.getCursorScreenPoint()
        cleanup()
        resolve({ x: Math.round(pt.x), y: Math.round(pt.y) })
      }

      const onCancel = (): void => {
        cleanup()
        resolve(null)
      }

      ipcMain.once('picker:picked', onPicked)
      ipcMain.once('picker:cancel', onCancel)

      pickerWindow.on('closed', () => {
        pickerWindow = null
        // Remove listeners if window was closed externally (not via pick/cancel)
        ipcMain.removeListener('picker:picked', onPicked)
        ipcMain.removeListener('picker:cancel', onCancel)
        resolve(null)
      })
    })
  })

  // Save all profiles
  ipcMain.handle('profiles:save', async (_event, data: AppData) => {
    try {
      fs.writeFileSync(PROFILES_FILE, JSON.stringify(data, null, 2), 'utf-8')
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  // Load all profiles
  ipcMain.handle('profiles:load', async () => {
    try {
      if (!fs.existsSync(PROFILES_FILE)) return { ok: true, data: null }
      const raw = fs.readFileSync(PROFILES_FILE, 'utf-8')
      return { ok: true, data: JSON.parse(raw) as AppData }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  // Get current status
  ipcMain.handle('status:get', async () => {
    if (getIsRunning()) return 'running'
    if (isScheduled()) return 'scheduled'
    return 'idle'
  })

  // ── Window visibility ───────────────────────────────────────────────────────
  ipcMain.handle('window:hide', async () => {
    getMainWindow()?.hide()
    return { ok: true }
  })

  ipcMain.handle('window:show', async () => {
    const win = getMainWindow()
    if (win) {
      win.show()
      win.focus()
    }
    return { ok: true }
  })

  // ── Update checker ──────────────────────────────────────────────────────────
  ipcMain.handle('updater:check', async () => {
    try {
      const info = await checkForUpdates()
      return { ok: true, info }
    } catch (e) {
      return { ok: false, error: String(e), info: null }
    }
  })

  // App version
  ipcMain.handle('app:version', () => app.getVersion())
}
