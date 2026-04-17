import { contextBridge, ipcRenderer } from 'electron'
import { ClickTask, HotkeyConfig, RecordedPoint, ScheduleConfig, AppData, ReleaseInfo } from '../renderer/src/types'

const clickerAPI = {
  platform: process.platform,
  setActiveTask: (task: ClickTask) => ipcRenderer.invoke('task:setActive', task),
  startTask: (task: ClickTask) => ipcRenderer.invoke('clicker:start', task),
  stopTask: () => ipcRenderer.invoke('clicker:stop'),
  startRecording: () => ipcRenderer.invoke('recording:start'),
  stopRecording: (): Promise<{ ok: boolean; points: RecordedPoint[] }> =>
    ipcRenderer.invoke('recording:stop'),
  setSchedule: (config: ScheduleConfig, tasks: ClickTask[]) =>
    ipcRenderer.invoke('schedule:set', config, tasks),
  cancelSchedule: () => ipcRenderer.invoke('schedule:cancel'),
  registerHotkey: (config: HotkeyConfig) => ipcRenderer.invoke('hotkey:register', config),
  pickCoordinate: (): Promise<{ x: number; y: number } | null> =>
    ipcRenderer.invoke('screen:pick'),
  saveProfiles: (data: AppData) => ipcRenderer.invoke('profiles:save', data),
  loadProfiles: (): Promise<{ ok: boolean; data: AppData | null }> =>
    ipcRenderer.invoke('profiles:load'),
  getStatus: () => ipcRenderer.invoke('status:get'),
  onStatusChange: (cb: (status: string) => void): (() => void) => {
    const handler = (_: unknown, status: string): void => cb(status)
    ipcRenderer.on('status:change', handler)
    return () => ipcRenderer.removeListener('status:change', handler)
  },
  pickerPicked: (coords: { x: number; y: number }) =>
    ipcRenderer.send('picker:picked', coords),
  pickerCancel: () => ipcRenderer.send('picker:cancel'),
  // Window visibility
  hideWindow: () => ipcRenderer.invoke('window:hide'),
  showWindow: () => ipcRenderer.invoke('window:show'),
  // Update checker
  checkForUpdates: (): Promise<{ ok: boolean; info: ReleaseInfo | null; error?: string }> =>
    ipcRenderer.invoke('updater:check'),
  // App version
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  // Image pick
  pickImage: (): Promise<{ ok: boolean; base64?: string; name?: string; error?: string }> =>
    ipcRenderer.invoke('image:pick')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('clickerAPI', clickerAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.clickerAPI = clickerAPI
}
