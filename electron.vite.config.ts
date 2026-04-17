import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    // robotjs: native module, must stay as require() + asarUnpack
    // node-schedule: pure JS but cron-parser (its dep) isn't hoisted by pnpm → bundle inline
    // jimp: pure JS image processing, bundle inline to avoid pnpm hoisting issues
    plugins: [externalizeDepsPlugin({ exclude: ['robotjs', 'node-schedule', 'jimp'] })]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          picker: resolve('src/renderer/picker.html'),
          regionPicker: resolve('src/renderer/regionPicker.html')
        }
      }
    }
  }
})
