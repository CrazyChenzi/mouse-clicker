import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'

declare const window: Window & {
  clickerAPI: {
    regionPicked: (region: { x: number; y: number; width: number; height: number }) => void
    regionCancel: () => void
  }
}

type SelState = 'idle' | 'selecting' | 'selected'
interface Pos { x: number; y: number }
interface Region { x: number; y: number; width: number; height: number }

function toRegion(a: Pos, b: Pos): Region {
  return {
    x: Math.round(Math.min(a.x, b.x)),
    y: Math.round(Math.min(a.y, b.y)),
    width: Math.round(Math.abs(b.x - a.x)),
    height: Math.round(Math.abs(b.y - a.y))
  }
}

function RegionPickerOverlay(): React.JSX.Element {
  const [state, setState] = useState<SelState>('idle')
  const [start, setStart] = useState<Pos>({ x: 0, y: 0 })
  const [current, setCurrent] = useState<Pos>({ x: 0, y: 0 })
  const [region, setRegion] = useState<Region | null>(null)
  const [mousePos, setMousePos] = useState<Pos>({ x: 0, y: 0 })

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') window.clickerAPI.regionCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onMouseDown = (e: React.MouseEvent): void => {
    if (e.button !== 0) return
    setStart({ x: e.clientX, y: e.clientY })
    setCurrent({ x: e.clientX, y: e.clientY })
    setRegion(null)
    setState('selecting')
  }

  const onMouseMove = (e: React.MouseEvent): void => {
    setMousePos({ x: e.clientX, y: e.clientY })
    if (state === 'selecting') {
      setCurrent({ x: e.clientX, y: e.clientY })
    }
  }

  const onMouseUp = (e: React.MouseEvent): void => {
    if (state !== 'selecting') return
    const r = toRegion(start, { x: e.clientX, y: e.clientY })
    if (r.width > 8 && r.height > 8) {
      setRegion(r)
      setState('selected')
    } else {
      setState('idle')
    }
  }

  const handleConfirm = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (region) window.clickerAPI.regionPicked(region)
  }

  const handleReselect = (e: React.MouseEvent): void => {
    e.stopPropagation()
    setState('idle')
    setRegion(null)
  }

  const liveRegion = state === 'selecting' ? toRegion(start, current) : region

  // Positions for confirm buttons — try to keep them inside screen
  const btnTop = liveRegion ? Math.min(liveRegion.y + liveRegion.height + 10, window.innerHeight - 50) : 0
  const btnLeft = liveRegion ? Math.max(0, Math.min(liveRegion.x + liveRegion.width / 2 - 100, window.innerWidth - 220)) : 0

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      style={{ position: 'fixed', inset: 0, cursor: 'crosshair', userSelect: 'none' }}
    >
      {/* Full dim when idle */}
      {!liveRegion && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', pointerEvents: 'none' }} />
      )}

      {/* 4-panel dim around selection */}
      {liveRegion && (<>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: liveRegion.y, background: 'rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
        <div style={{ position: 'fixed', top: liveRegion.y, left: 0, width: liveRegion.x, height: liveRegion.height, background: 'rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
        <div style={{ position: 'fixed', top: liveRegion.y, left: liveRegion.x + liveRegion.width, right: 0, height: liveRegion.height, background: 'rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
        <div style={{ position: 'fixed', top: liveRegion.y + liveRegion.height, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', pointerEvents: 'none' }} />

        {/* Selection border */}
        <div style={{
          position: 'fixed', top: liveRegion.y, left: liveRegion.x,
          width: liveRegion.width, height: liveRegion.height,
          border: '2px solid #3b82f6', boxSizing: 'border-box', pointerEvents: 'none'
        }}>
          {/* Corner indicators */}
          {[['top:-4px', 'left:-4px'], ['top:-4px', 'right:-4px'], ['bottom:-4px', 'left:-4px'], ['bottom:-4px', 'right:-4px']].map((pos, i) => (
            <div key={i} style={{
              position: 'absolute', width: 8, height: 8,
              background: '#3b82f6', borderRadius: 1,
              ...Object.fromEntries(pos.map(p => p.split(':')))
            }} />
          ))}

          {/* Size badge */}
          <div style={{
            position: 'absolute', top: -28, left: 0,
            background: '#1d4ed8', color: 'white', fontSize: 11,
            padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap',
            fontFamily: 'monospace', fontWeight: 600
          }}>
            {liveRegion.width} × {liveRegion.height}
          </div>
        </div>
      </>)}

      {/* Mouse coordinate tooltip (when not selecting) */}
      {state === 'idle' && (
        <div style={{
          position: 'fixed', left: mousePos.x + 14, top: mousePos.y + 14,
          background: 'rgba(0,0,0,0.75)', color: 'white',
          padding: '3px 8px', borderRadius: 4, fontSize: 11,
          fontFamily: 'monospace', pointerEvents: 'none', whiteSpace: 'nowrap'
        }}>
          ({mousePos.x}, {mousePos.y})
        </div>
      )}

      {/* Instruction (idle only) */}
      {state === 'idle' && (
        <div style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', color: 'white',
          textShadow: '0 1px 4px rgba(0,0,0,0.9)', pointerEvents: 'none'
        }}>
          <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>按住拖动，选取要识别的区域</p>
          <p style={{ fontSize: 13, opacity: 0.75 }}>按 ESC 取消</p>
        </div>
      )}

      {/* Confirm / reselect buttons */}
      {state === 'selected' && region && (
        <div style={{
          position: 'fixed', top: btnTop, left: btnLeft,
          display: 'flex', gap: 8, zIndex: 9999
        }}>
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={handleReselect}
            style={{
              padding: '6px 16px', background: 'rgba(255,255,255,0.92)',
              border: '1px solid #e2e8f0', borderRadius: 6,
              cursor: 'pointer', fontSize: 13, color: '#475569', fontWeight: 500
            }}>
            重新选取
          </button>
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={handleConfirm}
            style={{
              padding: '6px 18px', background: '#3b82f6', color: 'white',
              border: 'none', borderRadius: 6, cursor: 'pointer',
              fontSize: 13, fontWeight: 600
            }}>
            确认截取
          </button>
        </div>
      )}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RegionPickerOverlay />
  </React.StrictMode>
)
