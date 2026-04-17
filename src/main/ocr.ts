import { exec } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

/**
 * Performs OCR on the image at `imagePath`.
 * macOS  → Vision framework via swift interpreter
 * Windows → Windows.Media.Ocr via PowerShell
 * Linux  → not supported (returns '')
 */
export async function recognizeText(imagePath: string): Promise<string> {
  if (process.platform === 'darwin') return ocrMacOS(imagePath)
  if (process.platform === 'win32') return ocrWindows(imagePath)
  return ''
}

// ── macOS ──────────────────────────────────────────────────────────────────
function ocrMacOS(imagePath: string): Promise<string> {
  // Write swift script to a temp file (avoids shell quoting issues)
  const scriptPath = path.join(os.tmpdir(), `mc-ocr-${Date.now()}.swift`)
  const escapedPath = imagePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

  const swiftCode = `
import Vision
import Foundation
import CoreGraphics

let imagePath = "${escapedPath}"
let url = URL(fileURLWithPath: imagePath)

guard let cgSrc = CGImageSourceCreateWithURL(url as CFURL, nil),
      let cgImage = CGImageSourceCreateImageAtIndex(cgSrc, 0, nil) else {
  print("")
  exit(0)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US"]
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
try? handler.perform([request])

let text = (request.results ?? [])
  .compactMap { $0.topCandidates(1).first?.string }
  .joined(separator: " ")

print(text)
`

  fs.writeFileSync(scriptPath, swiftCode, 'utf-8')

  return new Promise((resolve) => {
    exec(`swift "${scriptPath}"`, { timeout: 25000 }, (err, stdout) => {
      try { fs.unlinkSync(scriptPath) } catch { /* ignore */ }
      if (err) {
        console.error('[OCR macOS]', err.message)
        resolve('')
      } else {
        resolve(stdout.trim())
      }
    })
  })
}

// ── Windows ────────────────────────────────────────────────────────────────
function ocrWindows(imagePath: string): Promise<string> {
  const escapedPath = imagePath.replace(/'/g, "''")

  // Uses Windows.Media.Ocr via PowerShell (works on Windows 10+)
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation,ContentType=WindowsRuntime]

function Await($WinRtTask, $ResultType) {
  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethod(
    'AsTask', [System.Type[]]@([Type]::GetType('Windows.Foundation.IAsyncOperation\`1').MakeGenericType($ResultType)))
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}

$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync('${escapedPath}')) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if ($engine) {
  $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  $text = ($result.Lines | ForEach-Object { $_.Text }) -join ' '
  Write-Output $text
}
`

  return new Promise((resolve) => {
    exec(`powershell -noprofile -command "${ps.replace(/"/g, '\\"')}"`,
      { timeout: 20000 },
      (err, stdout) => {
        if (err) {
          console.error('[OCR Windows]', err.message)
          resolve('')
        } else {
          resolve(stdout.trim())
        }
      }
    )
  })
}
