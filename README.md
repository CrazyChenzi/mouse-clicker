# Mouse Clicker

<div align="center">

**English** | [中文](#中文)

A cross-platform desktop auto-clicker built with Electron. Record click sequences, schedule them, and replay with precision.

[![Release](https://img.shields.io/github/v/release/CrazyChenzi/mouse-clicker)](https://github.com/CrazyChenzi/mouse-clicker/releases)
[![Build](https://github.com/CrazyChenzi/mouse-clicker/actions/workflows/build.yml/badge.svg)](https://github.com/CrazyChenzi/mouse-clicker/actions/workflows/build.yml)
[![License](https://img.shields.io/github/license/CrazyChenzi/mouse-clicker)](LICENSE)

</div>

---

## Features

- **Click Actions** — Add click targets by typing coordinates or using the on-screen picker. Set click count, delay, and mouse button per action.
- **Multiple Task Profiles** — Create and switch between named task profiles. Each profile has independent actions, repeat count, and interval settings.
- **Mouse Trajectory Recording** — Record real mouse movements and convert them into a replayable click sequence.
- **Scheduled Auto-Start** — Pick a date and time (to the second) and select which task profiles to run in sequence.
- **Global Hotkey** — Start / stop the current task from any app. Default: <kbd>F8</kbd>, fully customisable.
- **Hide Window** — One-click button to hide the app window while picking screen coordinates; window automatically hides and restores during the pick flow.
- **Auto-Save** — All configurations are saved locally after every change and restored on next launch.
- **Check for Updates** — One-click update check from the Settings tab; opens the release page in your browser when a new version is available.

## Download

Go to [**Releases**](https://github.com/CrazyChenzi/mouse-clicker/releases) and download the installer for your platform:

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `MouseClicker-x.x.x-arm64.dmg` |
| Windows 64-bit | `MouseClicker-Setup-x.x.x.exe` |

> **macOS note** — The app is unsigned. On first launch, right-click the `.dmg` → Open, then grant **Accessibility** permission in System Settings → Privacy & Security → Accessibility.

## Development

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 10

```bash
# Clone
git clone https://github.com/CrazyChenzi/mouse-clicker.git
cd mouse-clicker

# Install dependencies
pnpm install

# Rebuild native module for Electron
pnpm exec electron-rebuild -f -w robotjs

# Start dev server
pnpm dev
```

### Build

```bash
# macOS (arm64)
pnpm build:mac

# Windows
pnpm build:win
```

> On macOS, `ELECTRON_RUN_AS_NODE` must be unset (the `pnpm dev` script handles this automatically).

### Release

Use the **Create Release** GitHub Actions workflow:

1. Actions → **Create Release** → Run workflow
2. Choose a version bump type (`patch` / `minor` / `major` / `custom`)
3. The workflow bumps `package.json`, pushes a git tag, builds all platforms, and creates a draft GitHub Release.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Electron 31 + electron-vite |
| UI | React 19 + TypeScript + Tailwind CSS |
| UI Components | Ant Design 6 |
| Mouse Control | robotjs |
| Scheduling | node-schedule |
| Package Manager | pnpm |
| CI/CD | GitHub Actions |

## License

[MIT](LICENSE)

---

# 中文

<div align="center">

[English](#mouse-clicker) | **中文**

一款跨平台桌面鼠标自动点击工具，基于 Electron 构建。录制点击序列、定时执行、精准回放。

</div>

## 功能特性

- **点击动作** — 通过输入坐标或屏幕选取器添加点击目标，可设置每个动作的点击次数、间隔和鼠标按键。
- **多任务配置** — 创建并切换命名任务配置，每个配置独立管理动作列表、重复次数和间隔设置。
- **鼠标轨迹录制** — 录制真实鼠标移动，并转换为可回放的点击序列。
- **定时自动启动** — 精确到秒级选择执行时间，支持选择多个任务配置按顺序串行执行。
- **全局快捷键** — 在任意应用中启动/停止当前任务，默认 <kbd>F8</kbd>，可自定义。
- **隐藏窗口** — 标题栏一键隐藏应用窗口，方便选取屏幕坐标；点击「屏幕选取」时也会自动隐藏并在完成后恢复。
- **自动保存** — 每次修改后自动保存配置到本地，下次启动自动恢复。
- **检查更新** — 在设置页一键检查更新，有新版本时直接跳转到下载页面。

## 下载安装

前往 [**Releases**](https://github.com/CrazyChenzi/mouse-clicker/releases) 下载对应平台的安装包：

| 平台 | 文件 |
|------|------|
| macOS（Apple Silicon） | `MouseClicker-x.x.x-arm64.dmg` |
| Windows 64位 | `MouseClicker-Setup-x.x.x.exe` |

> **macOS 说明** — 应用未进行代码签名。首次启动时，右键点击 `.dmg` 选择「打开」，然后在「系统设置 → 隐私与安全性 → 辅助功能」中授权 MouseClicker，授权后重启应用。

## 开发

### 前置条件

- Node.js ≥ 20
- pnpm ≥ 10

```bash
# 克隆仓库
git clone https://github.com/CrazyChenzi/mouse-clicker.git
cd mouse-clicker

# 安装依赖
pnpm install

# 为 Electron 重新编译原生模块
pnpm exec electron-rebuild -f -w robotjs

# 启动开发服务器
pnpm dev
```

### 构建打包

```bash
# macOS（arm64）
pnpm build:mac

# Windows
pnpm build:win
```

### 发布新版本

使用 GitHub Actions 的 **Create Release** 工作流：

1. Actions → **Create Release** → Run workflow
2. 选择版本升级类型（`patch` / `minor` / `major` / `custom`）
3. 工作流会自动完成：升级 `package.json` 版本 → 打 tag → 构建所有平台 → 创建 Draft GitHub Release

## 技术栈

| 层次 | 技术 |
|------|------|
| 框架 | Electron 31 + electron-vite |
| UI | React 19 + TypeScript + Tailwind CSS |
| UI 组件库 | Ant Design 6 |
| 鼠标控制 | robotjs |
| 定时调度 | node-schedule |
| 包管理 | pnpm |
| CI/CD | GitHub Actions |

## 许可证

[MIT](LICENSE)
