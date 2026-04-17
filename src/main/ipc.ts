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
import { checkForUpdates, downloadUpdate } from './updater'
import { fileToBase64, captureAndCropRegion } from './imageMatcher'
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

  // ── Update download (with resume support) ──────────────────────────────────
  ipcMain.handle('updater:download', async (_event, downloadUrl: string) => {
    const win = getMainWindow()
    // Use userData/downloads so partial files survive app restarts
    const downloadsDir = path.join(app.getPath('userData'), 'downloads')
    if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true })

    const fileName = downloadUrl.split('/').pop() ?? 'MouseClicker-update'
    const destPath = path.join(downloadsDir, fileName)
    const infoPath = destPath + '.info'

    // If file already fully downloaded (no sidecar .info), return it immediately
    if (fs.existsSync(destPath) && !fs.existsSync(infoPath)) {
      const size = fs.existsSync(destPath) ? fs.statSync(destPath).size : 0
      if (size > 0) {
        win?.webContents.send('updater:download-progress', 100)
        return { ok: true, filePath: destPath }
      }
    }

    try {
      await downloadUpdate(downloadUrl, destPath, (progress) => {
        win?.webContents.send('updater:download-progress', Math.round(progress * 100))
      })
      return { ok: true, filePath: destPath }
    } catch (e) {
      // Partial file is preserved for next resume attempt
      return { ok: false, error: String(e) }
    }
  })

  // Open downloaded file with OS default handler
  ipcMain.handle('updater:open-file', async (_event, filePath: string) => {
    const { shell } = require('electron')
    const err = await shell.openPath(filePath)
    return { ok: !err, error: err || undefined }
  })

  // ── Screen region capture ────────────────────────────────────────────────────
  ipcMain.handle('screen:capture-region', async () => {
    return new Promise<{ ok: boolean; base64?: string; name?: string; centerX?: number; centerY?: number; error?: string }>((resolve) => {
      const display = screen.getPrimaryDisplay()
      const { x: dx, y: dy, width, height } = display.bounds

      const regionWindow = new BrowserWindow({
        x: dx, y: dy, width, height,
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
      regionWindow.setAlwaysOnTop(true, 'screen-saver')
      regionWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

      if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
        regionWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/regionPicker.html')
      } else {
        regionWindow.loadFile(join(__dirname, '../renderer/regionPicker.html'))
      }

      regionWindow.once('ready-to-show', () => {
        regionWindow.show()
        regionWindow.focus()
      })

      const cleanupRegion = (): void => {
        if (!regionWindow.isDestroyed()) regionWindow.close()
        ipcMain.removeListener('region:picked', onPicked)
        ipcMain.removeListener('region:cancel', onCancel)
      }

      const onPicked = async (_e: unknown, region: { x: number; y: number; width: number; height: number }): Promise<void> => {
        cleanupRegion()
        // Small delay so the overlay window fully closes before we screenshot
        await new Promise(r => setTimeout(r, 150))
        try {
          const result = await captureAndCropRegion(region)
          resolve({ ok: true, base64: result.base64, name: 'capture.png', centerX: result.centerX, centerY: result.centerY })
        } catch (e) {
          resolve({ ok: false, error: String(e) })
        }
      }

      const onCancel = (): void => {
        cleanupRegion()
        resolve({ ok: false })
      }

      ipcMain.once('region:picked', onPicked)
      ipcMain.once('region:cancel', onCancel)
      regionWindow.on('closed', () => { ipcMain.removeListener('region:picked', onPicked); ipcMain.removeListener('region:cancel', onCancel); resolve({ ok: false }) })
    })
  })

  // ── Image pick (open file dialog and return base64) ─────────────────────────
  ipcMain.handle('image:pick', async () => {
    const { dialog } = require('electron')
    const result = await dialog.showOpenDialog(getMainWindow()!, {
      title: '选择参考图片',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return { ok: false }
    const filePath = result.filePaths[0]
    const name = filePath.split(/[/\\]/).pop() ?? 'image'
    try {
      const base64 = fileToBase64(filePath)
      return { ok: true, base64, name }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })
}
