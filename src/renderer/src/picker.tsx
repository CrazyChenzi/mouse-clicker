import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'

// The clickerAPI type is declared globally in App.tsx; here we only need
// pickerPicked and pickerCancel — cast as any to avoid duplicate interface conflict
declare const window: Window & {
  clickerAPI: {
    pickerPicked: (coords: { x: number; y: number }) => void
    pickerCancel: () => void
  }
}

function PickerOverlay(): React.JSX.Element {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      setMousePos({ x: Math.round(e.clientX), y: Math.round(e.clientY) })
    }
    window.addEventListener('mousemove', handleMouseMove)

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        window.clickerAPI.pickerCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleClick = (e: React.MouseEvent): void => {
    e.preventDefault()
    window.clickerAPI.pickerPicked({
      x: Math.round(e.clientX),
      y: Math.round(e.clientY)
    })
  }

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.3)',
        cursor: 'crosshair',
        outline: 'none'
      }}
    >
      {/* Instruction hint */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: 'white',
          textShadow: '0 1px 4px rgba(0,0,0,0.9)',
          pointerEvents: 'none'
        }}
      >
        <p style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>点击屏幕上的目标位置</p>
        <p style={{ fontSize: 14, opacity: 0.8 }}>按 ESC 取消</p>
      </div>

      {/* Crosshairs at mouse */}
      <div
        style={{
          position: 'fixed',
          left: mousePos.x - 1,
          top: 0,
          width: 2,
          height: '100%',
          background: 'rgba(255,255,255,0.4)',
          pointerEvents: 'none'
        }}
      />
      <div
        style={{
          position: 'fixed',
          left: 0,
          top: mousePos.y - 1,
          width: '100%',
          height: 2,
          background: 'rgba(255,255,255,0.4)',
          pointerEvents: 'none'
        }}
      />

      {/* Coordinate tooltip */}
      <div
        style={{
          position: 'fixed',
          left: mousePos.x + 14,
          top: mousePos.y + 14,
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '4px 10px',
          borderRadius: 6,
          fontSize: 13,
          fontFamily: 'monospace',
          pointerEvents: 'none',
          userSelect: 'none',
          whiteSpace: 'nowrap'
        }}
      >
        ({mousePos.x}, {mousePos.y})
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <PickerOverlay />
  </React.StrictMode>
)
