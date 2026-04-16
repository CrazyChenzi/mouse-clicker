declare module 'robotjs' {
  interface MousePos {
    x: number
    y: number
  }

  function moveMouse(x: number, y: number): void
  function moveMouseSmooth(x: number, y: number, speed?: number): void
  function mouseClick(button?: 'left' | 'right' | 'middle', double?: boolean): void
  function mouseToggle(down?: 'down' | 'up', button?: 'left' | 'right' | 'middle'): void
  function dragMouse(x: number, y: number): void
  function getMousePos(): MousePos
  function scrollMouse(x: number, y: number): void

  function keyTap(key: string, modifier?: string | string[]): void
  function keyToggle(key: string, down: 'down' | 'up', modifier?: string | string[]): void
  function typeString(string: string): void
  function typeStringDelayed(string: string, cpm: number): void

  function setMouseDelay(delay: number): void
  function setKeyboardDelay(delay: number): void
}
