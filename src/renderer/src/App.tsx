import React, { useState, useEffect, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { ClickTask, ScheduleConfig, HotkeyConfig, AppStatus, AppData } from './types'
import ClickList from './components/ClickList'
import Recorder from './components/Recorder'
import Scheduler from './components/Scheduler'
import Settings from './components/Settings'
import Controls from './components/Controls'

type Tab = 'clicks' | 'recorder' | 'schedule' | 'settings'

function makeDefaultProfile(name = '任务 1'): ClickTask {
  return {
    id: uuidv4(),
    name,
    actions: [],
    repeatCount: 1,
    delayBetweenActions: 500
  }
}

const DEFAULT_SCHEDULE: ScheduleConfig = { enabled: false, startAt: null, taskIds: [] }
const DEFAULT_HOTKEY: HotkeyConfig = { startStop: 'F8' }

declare global {
  interface Window {
    clickerAPI: {
      platform: string
      setActiveTask: (task: ClickTask) => Promise<{ ok: boolean }>
      startTask: (task: ClickTask) => Promise<{ ok: boolean }>
      stopTask: () => Promise<{ ok: boolean }>
      startRecording: () => Promise<{ ok: boolean }>
      stopRecording: () => Promise<{ ok: boolean; points: import('./types').RecordedPoint[] }>
      setSchedule: (config: ScheduleConfig, tasks: ClickTask[]) => Promise<{ ok: boolean }>
      cancelSchedule: () => Promise<{ ok: boolean }>
      registerHotkey: (config: HotkeyConfig) => Promise<{ ok: boolean }>
      pickCoordinate: () => Promise<{ x: number; y: number } | null>
      saveProfiles: (data: AppData) => Promise<{ ok: boolean }>
      loadProfiles: () => Promise<{ ok: boolean; data: AppData | null }>
      getStatus: () => Promise<AppStatus>
      onStatusChange: (cb: (status: string) => void) => () => void
      pickerPicked: (coords: { x: number; y: number }) => void
      pickerCancel: () => void
      hideWindow: () => Promise<{ ok: boolean }>
      showWindow: () => Promise<{ ok: boolean }>
      checkForUpdates: () => Promise<{ ok: boolean; info: import('./types').ReleaseInfo | null; error?: string }>
    }
  }
}

export default function App(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('clicks')
  const [profiles, setProfiles] = useState<ClickTask[]>([makeDefaultProfile()])
  const [activeProfileId, setActiveProfileId] = useState<string>('')
  const [schedule, setSchedule] = useState<ScheduleConfig>(DEFAULT_SCHEDULE)
  const [hotkey, setHotkey] = useState<HotkeyConfig>(DEFAULT_HOTKEY)
  const [status, setStatus] = useState<AppStatus>('idle')
  const [saveIndicator, setSaveIndicator] = useState(false)
  const [windowHidden, setWindowHidden] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Derived: active task profile
  const activeProfile = profiles.find(p => p.id === activeProfileId) ?? profiles[0]

  // ── Load saved data on startup ─────────────────────────────────────────────
  useEffect(() => {
    window.clickerAPI.loadProfiles().then((res) => {
      if (res.ok && res.data && res.data.profiles.length > 0) {
        setProfiles(res.data.profiles)
        setActiveProfileId(res.data.activeProfileId)
      } else {
        const p = makeDefaultProfile()
        setProfiles([p])
        setActiveProfileId(p.id)
      }
    })
    window.clickerAPI.getStatus().then(setStatus)
    const unsub = window.clickerAPI.onStatusChange((s) => setStatus(s.split(':')[0] as AppStatus))
    return unsub
  }, [])

  // ── Sync active profile to main process so F8 hotkey always has the right task ──
  useEffect(() => {
    if (activeProfile) {
      window.clickerAPI.setActiveTask(activeProfile)
    }
  }, [activeProfile])

  // ── Auto-save with debounce whenever profiles change ──────────────────────
  useEffect(() => {
    if (!activeProfileId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const data: AppData = { profiles, activeProfileId }
      window.clickerAPI.saveProfiles(data).then((res) => {
        if (res.ok) {
          setSaveIndicator(true)
          setTimeout(() => setSaveIndicator(false), 1200)
        }
      })
    }, 800)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [profiles, activeProfileId])

  // ── Profile management ────────────────────────────────────────────────────
  const updateActiveProfile = useCallback((updated: ClickTask) => {
    setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p))
  }, [])

  const createProfile = useCallback(() => {
    const p = makeDefaultProfile(`任务 ${profiles.length + 1}`)
    setProfiles(prev => [...prev, p])
    setActiveProfileId(p.id)
  }, [profiles.length])

  const deleteProfile = useCallback((id: string) => {
    setProfiles(prev => {
      const next = prev.filter(p => p.id !== id)
      if (next.length === 0) {
        const p = makeDefaultProfile()
        setActiveProfileId(p.id)
        return [p]
      }
      if (id === activeProfileId) setActiveProfileId(next[0].id)
      return next
    })
  }, [activeProfileId])

  // ── Controls ──────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (!activeProfile || activeProfile.actions.length === 0) return
    await window.clickerAPI.startTask(activeProfile)
  }, [activeProfile])

  const handleStop = useCallback(async () => {
    await window.clickerAPI.stopTask()
    if (schedule.enabled) {
      await window.clickerAPI.cancelSchedule()
      setSchedule(s => ({ ...s, enabled: false }))
    }
  }, [schedule.enabled])

  const handleScheduleSave = useCallback(async (cfg: ScheduleConfig) => {
    setSchedule(cfg)
    if (cfg.enabled && cfg.startAt && cfg.taskIds.length > 0) {
      const targets = cfg.taskIds
        .map(id => profiles.find(p => p.id === id))
        .filter((p): p is ClickTask => p !== undefined)
      if (targets.length > 0) {
        await window.clickerAPI.setSchedule(cfg, targets)
      }
    } else {
      await window.clickerAPI.cancelSchedule()
    }
  }, [profiles])

  const handleHotkeySave = useCallback(async (cfg: HotkeyConfig) => {
    setHotkey(cfg)
    await window.clickerAPI.registerHotkey(cfg)
  }, [])

  const addRecordedActions = useCallback((actions: ClickTask['actions']) => {
    if (!activeProfile) return
    updateActiveProfile({ ...activeProfile, actions: [...activeProfile.actions, ...actions] })
  }, [activeProfile, updateActiveProfile])

  const toggleWindow = useCallback(async () => {
    if (windowHidden) {
      await window.clickerAPI.showWindow()
      setWindowHidden(false)
    } else {
      await window.clickerAPI.hideWindow()
      setWindowHidden(true)
    }
  }, [windowHidden])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'clicks', label: '点击动作' },
    { id: 'recorder', label: '录制轨迹' },
    { id: 'schedule', label: '定时启动' },
    { id: 'settings', label: '设置' }
  ]

  const isMac = window.clickerAPI.platform === 'darwin'

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Title bar */}
      <div
        className="drag-region flex items-center bg-white border-b border-slate-200"
        style={{ height: isMac ? 52 : 40, paddingLeft: isMac ? 80 : 16, paddingRight: 12 }}
      >
        <span className="text-sm font-semibold text-slate-700">Mouse Clicker</span>
        {saveIndicator && (
          <span className="ml-2 text-xs text-green-500 transition-opacity">已保存</span>
        )}
        <div className="ml-auto">
          <button
            onClick={toggleWindow}
            title={windowHidden ? '显示窗口' : '隐藏窗口（选取坐标时使用）'}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
          >
            {windowHidden ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            )}
            {windowHidden ? '显示' : '隐藏'}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex bg-white border-b border-slate-200 px-4 gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'clicks' && activeProfile && (
          <ClickList
            profiles={profiles}
            activeProfile={activeProfile}
            onActiveChange={setActiveProfileId}
            onProfileUpdate={updateActiveProfile}
            onProfileCreate={createProfile}
            onProfileDelete={deleteProfile}
            status={status}
          />
        )}
        {tab === 'recorder' && (
          <Recorder onAddActions={addRecordedActions} />
        )}
        {tab === 'schedule' && (
          <Scheduler
            config={schedule}
            profiles={profiles}
            onSave={handleScheduleSave}
            status={status}
          />
        )}
        {tab === 'settings' && (
          <Settings
            hotkey={hotkey}
            onSaveHotkey={handleHotkeySave}
          />
        )}
      </div>

      {/* Bottom controls */}
      <Controls
        status={status}
        actionCount={activeProfile?.actions.length ?? 0}
        profileName={activeProfile?.name}
        onStart={handleStart}
        onStop={handleStop}
        hotkey={hotkey.startStop}
      />
    </div>
  )
}
