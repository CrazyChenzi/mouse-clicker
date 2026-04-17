import React, { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { ClickAction, ClickTask, AppStatus } from '../types'
import ClickEditor from './ClickEditor'

interface Props {
  profiles: ClickTask[]
  activeProfile: ClickTask
  onActiveChange: (id: string) => void
  onProfileUpdate: (task: ClickTask) => void
  onProfileCreate: () => void
  onProfileDelete: (id: string) => void
  hideOnPick: boolean
  status: AppStatus
}

export default function ClickList({
  profiles,
  activeProfile,
  onActiveChange,
  onProfileUpdate,
  onProfileCreate,
  onProfileDelete,
  hideOnPick,
  status
}: Props): React.JSX.Element {
  const [editingAction, setEditingAction] = useState<ClickAction | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  const isRunning = status === 'running'
  const task = activeProfile

  const openAdd = (): void => {
    setEditingAction({
      id: uuidv4(),
      x: 0,
      y: 0,
      count: 1,
      delayBetweenClicks: 100,
      button: 'left',
      description: ''
    })
    setEditingIndex(null)
    setShowEditor(true)
  }

  const openEdit = (action: ClickAction, index: number): void => {
    setEditingAction({ ...action })
    setEditingIndex(index)
    setShowEditor(true)
  }

  const handleSave = (action: ClickAction): void => {
    const newActions = [...task.actions]
    if (editingIndex !== null) {
      newActions[editingIndex] = action
    } else {
      newActions.push(action)
    }
    onProfileUpdate({ ...task, actions: newActions })
    setShowEditor(false)
  }

  const handleDelete = (index: number): void => {
    onProfileUpdate({ ...task, actions: task.actions.filter((_, i) => i !== index) })
  }

  const moveUp = (index: number): void => {
    if (index === 0) return
    const a = [...task.actions]
    ;[a[index - 1], a[index]] = [a[index], a[index - 1]]
    onProfileUpdate({ ...task, actions: a })
  }

  const moveDown = (index: number): void => {
    if (index === task.actions.length - 1) return
    const a = [...task.actions]
    ;[a[index], a[index + 1]] = [a[index + 1], a[index]]
    onProfileUpdate({ ...task, actions: a })
  }

  const startEditName = (): void => {
    setNameInput(task.name)
    setEditingName(true)
  }

  const commitName = (): void => {
    const trimmed = nameInput.trim()
    if (trimmed) onProfileUpdate({ ...task, name: trimmed })
    setEditingName(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Profile selector bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 border-b border-slate-200">
        <span className="text-xs text-slate-500 shrink-0">任务：</span>
        <div className="flex items-center gap-1 flex-1 overflow-x-auto">
          {profiles.map(p => (
            <button
              key={p.id}
              onClick={() => onActiveChange(p.id)}
              className={`shrink-0 px-3 py-1 text-xs rounded-full border transition-colors ${
                p.id === task.id
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <button
          onClick={onProfileCreate}
          disabled={isRunning}
          title="新建任务"
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-white border border-slate-300 hover:border-blue-400 text-slate-500 hover:text-blue-500 disabled:opacity-40"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        {profiles.length > 1 && (
          <button
            onClick={() => onProfileDelete(task.id)}
            disabled={isRunning}
            title="删除当前任务"
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-white border border-slate-300 hover:border-red-400 text-slate-500 hover:text-red-500 disabled:opacity-40"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Task settings row */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-white border-b border-slate-200">
        {/* Editable task name */}
        <div className="flex items-center gap-1.5 min-w-0">
          {editingName ? (
            <input
              autoFocus
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false) }}
              className="w-28 px-2 py-0.5 text-sm border border-blue-400 rounded focus:outline-none"
            />
          ) : (
            <button
              onClick={startEditName}
              disabled={isRunning}
              className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-blue-600 disabled:cursor-default"
              title="点击重命名"
            >
              <span className="truncate max-w-32">{task.name}</span>
              <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2.414a2 2 0 01.586-1.414z" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">重复</label>
          <input
            type="number" min={0}
            value={task.repeatCount}
            onChange={e => onProfileUpdate({ ...task, repeatCount: Math.max(0, parseInt(e.target.value) || 0) })}
            disabled={isRunning}
            className="w-16 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />
          <span className="text-xs text-slate-400">次（0=∞）</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">间隔</label>
          <input
            type="number" min={0} step={100}
            value={task.delayBetweenActions}
            onChange={e => onProfileUpdate({ ...task, delayBetweenActions: Math.max(0, parseInt(e.target.value) || 0) })}
            disabled={isRunning}
            className="w-20 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />
          <span className="text-xs text-slate-400">ms</span>
        </div>

        <div className="ml-auto">
          <button
            onClick={openAdd}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            添加点击
          </button>
        </div>
      </div>

      {/* Action list */}
      <div className="flex-1 overflow-y-auto p-4">
        {task.actions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <svg className="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            <p className="text-sm font-medium">暂无点击动作</p>
            <p className="text-xs mt-1">点击右上角「添加点击」开始</p>
          </div>
        ) : (
          <div className="space-y-2">
            {task.actions.map((action, index) => (
              <ActionRow
                key={action.id}
                action={action}
                index={index}
                total={task.actions.length}
                isRunning={isRunning}
                onEdit={() => openEdit(action, index)}
                onDelete={() => handleDelete(index)}
                onMoveUp={() => moveUp(index)}
                onMoveDown={() => moveDown(index)}
              />
            ))}
          </div>
        )}
      </div>

      {showEditor && editingAction && (
        <ClickEditor
          action={editingAction}
          hideOnPick={hideOnPick}
          onSave={handleSave}
          onCancel={() => setShowEditor(false)}
        />
      )}
    </div>
  )
}

function ActionRow({
  action, index, total, isRunning, onEdit, onDelete, onMoveUp, onMoveDown
}: {
  action: ClickAction; index: number; total: number; isRunning: boolean
  onEdit: () => void; onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void
}): React.JSX.Element {
  const label = action.button === 'left' ? '左键' : action.button === 'right' ? '右键' : '中键'
  const isImage = action.type === 'image'
  return (
    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2.5 hover:border-slate-300 transition-colors">
      <span className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-600 text-xs font-bold rounded">{index + 1}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          {isImage ? (
            <>
              {action.imageBase64 && (
                <img src={action.imageBase64} alt="" className="h-6 w-auto rounded border border-slate-200 object-contain" />
              )}
              <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded font-medium shrink-0">图片识别</span>
              <span className="text-slate-500 text-xs truncate max-w-32">{action.imageName ?? ''}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500 text-xs">置信度 {Math.round((action.confidence ?? 0.8) * 100)}%</span>
            </>
          ) : (
            <>
              <span className="font-mono text-slate-700">({action.x}, {action.y})</span>
            </>
          )}
          <span className="text-slate-400">·</span>
          <span className="text-slate-600">{label} × {action.count}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500 text-xs">间隔 {action.delayBetweenClicks}ms</span>
          {action.description && (
            <><span className="text-slate-400">·</span>
            <span className="text-slate-400 text-xs truncate max-w-32">{action.description}</span></>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onMoveUp} disabled={index === 0 || isRunning} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed" title="上移">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
        </button>
        <button onClick={onMoveDown} disabled={index === total - 1 || isRunning} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed" title="下移">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
        <button onClick={onEdit} disabled={isRunning} className="p-1 text-blue-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed" title="编辑">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </button>
        <button onClick={onDelete} disabled={isRunning} className="p-1 text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed" title="删除">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  )
}
