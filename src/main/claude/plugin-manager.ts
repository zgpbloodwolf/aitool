import { existsSync } from 'fs'
import { join } from 'path'
import { execFile } from 'child_process'
import { resolveClaudeBinary } from './binary-resolver'
import { safeLog, safeError } from './logger'

interface SkillCommand {
  name: string
  description: string
}

function parseSkillMetadata(skillFile: string): { description: string } | null {
  try {
    const content = require('fs').readFileSync(skillFile, 'utf-8')
    const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)?.[1]
    let description = ''
    if (frontmatter) {
      const descLine = frontmatter.split('\n').find((l: string) => l.startsWith('description:'))
      if (descLine) description = descLine.replace(/^description:\s*"?/, '').replace(/"?\s*$/, '')
    }
    return { description }
  } catch {
    return null
  }
}

function scanSkillsDir(skillsDir: string, namePrefix = ''): SkillCommand[] {
  const commands: SkillCommand[] = []
  if (!existsSync(skillsDir)) return commands

  try {
    const entries = require('fs').readdirSync(skillsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const skillFile = join(skillsDir, entry.name, 'SKILL.md')
      if (!existsSync(skillFile)) continue
      const meta = parseSkillMetadata(skillFile)
      if (meta) {
        commands.push({ name: namePrefix + entry.name, description: meta.description })
      }
    }
  } catch { /* skip */ }

  return commands
}

export function discoverSkills(): SkillCommand[] {
  const homeDir = process.env.USERPROFILE || process.env.HOME || ''
  const claudeDir = join(homeDir, '.claude')
  const commands: SkillCommand[] = []

  commands.push(...scanSkillsDir(join(claudeDir, 'skills')))

  const pluginCacheDir = join(claudeDir, 'plugins', 'cache')
  if (existsSync(pluginCacheDir)) {
    try {
      const pluginDirs = require('fs').readdirSync(pluginCacheDir, { withFileTypes: true })
      for (const pluginDir of pluginDirs) {
        if (!pluginDir.isDirectory()) continue
        const pluginSkillsDir = join(pluginCacheDir, pluginDir.name, 'skills')
        if (existsSync(pluginSkillsDir)) {
          commands.push(...scanSkillsDir(pluginSkillsDir, pluginDir.name + ':'))
        }
      }
    } catch { /* skip */ }

    try {
      const marketplaces = require('fs').readdirSync(pluginCacheDir, { withFileTypes: true })
      for (const market of marketplaces) {
        if (!market.isDirectory()) continue
        const marketDir = join(pluginCacheDir, market.name)
        const subDirs = require('fs').readdirSync(marketDir, { withFileTypes: true })
        for (const sub of subDirs) {
          if (!sub.isDirectory()) continue
          const subSkillsDir = join(marketDir, sub.name, 'skills')
          if (existsSync(subSkillsDir)) {
            commands.push(...scanSkillsDir(subSkillsDir, sub.name + ':'))
          }
        }
      }
    } catch { /* skip */ }
  }

  safeLog('[PluginManager] 已发现技能:', commands.length)
  return commands
}

export async function runClaudeCliCommand(args: string[]): Promise<string> {
  const binaryPath = await resolveClaudeBinary()
  if (!binaryPath) throw new Error('未找到 Claude Code CLI')

  return new Promise((resolve, reject) => {
    const env = { ...process.env } as Record<string, string>
    execFile(binaryPath, args, {
      cwd: process.cwd(),
      env,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024
    }, (error, stdout, _stderr) => {
      if (error) {
        safeError('[PluginManager] CLI 命令失败:', args.join(' '), error.message)
        reject(error)
        return
      }
      resolve(stdout)
    })
  })
}
