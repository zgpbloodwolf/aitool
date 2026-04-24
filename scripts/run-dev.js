// Claude Code sets ELECTRON_RUN_AS_NODE=1 which breaks Electron app mode.
// This wrapper removes it before spawning electron-vite.
delete process.env.ELECTRON_RUN_AS_NODE

const { execSync } = require('child_process')

// 设置 Windows 控制台代码页为 UTF-8，防止中文日志乱码
if (process.platform === 'win32') {
  try {
    execSync('chcp 65001', { stdio: 'pipe' })
  } catch {}
}

const cmd = process.argv.slice(2)
execSync(`pnpm exec electron-vite ${cmd.length ? cmd.join(' ') : 'dev'}`, {
  stdio: 'inherit',
  env: process.env
})
