import { app, shell, BrowserWindow, ipcMain, globalShortcut, dialog } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'

let mainWindow: BrowserWindow | null = null

const isDev = !app.isPackaged

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    minWidth: 720,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    // Explicitly position traffic lights so they vertically center in our 40px title bar
    ...(process.platform === 'darwin' ? { trafficLightPosition: { x: 16, y: 12 } } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Set AppUserModelID for Windows
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.mouseclick.app')
  }

  // Check accessibility permissions on macOS
  if (process.platform === 'darwin') {
    const { systemPreferences } = require('electron')
    // Passing true will prompt the user AND open System Settings automatically
    const hasAccess = systemPreferences.isTrustedAccessibilityClient(true)
    if (!hasAccess) {
      const isDev = !app.isPackaged
      dialog.showMessageBox({
        type: 'warning',
        title: '需要辅助功能权限',
        message: 'MouseClicker 需要辅助功能权限才能控制鼠标。',
        detail: isDev
          ? '开发模式下请在系统设置 → 隐私与安全性 → 辅助功能中，添加并启用：\nnode_modules/electron/dist/Electron.app\n\n授权后重新启动应用即可生效。'
          : '请在系统设置 → 隐私与安全性 → 辅助功能中，添加并启用 MouseClicker，然后重启应用。',
        buttons: ['好的，去授权']
      })
    }
  }

  registerIpcHandlers(ipcMain, () => mainWindow)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

export { mainWindow }
