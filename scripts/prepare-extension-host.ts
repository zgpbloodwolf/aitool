import { mkdir, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { execSync } from 'child_process'

/**
 * Downloads VSCodium and extracts the extension host files.
 * Run: npx tsx scripts/prepare-extension-host.ts
 */
const VSCODIUM_VERSION = '1.96.0'
const TEMP_DIR = join(process.cwd(), '.tmp')
const OUTPUT_DIR = join(process.cwd(), 'extension-host')

async function main(): Promise<void> {
  console.log('Preparing VSCode extension host...')
  console.log(`VSCodium version: ${VSCODIUM_VERSION}`)

  const url = `https://github.com/VSCodium/vscodium/releases/download/${VSCODIUM_VERSION}/VSCodium-win32-x64-${VSCODIUM_VERSION}.zip`
  const zipPath = join(TEMP_DIR, 'vscodium.zip')
  const extractDir = join(TEMP_DIR, 'vscodium')

  mkdir(TEMP_DIR, { recursive: true })
  mkdir(OUTPUT_DIR, { recursive: true })

  console.log('Downloading VSCodium...')
  execSync(`curl -L -o "${zipPath}" "${url}"`, { stdio: 'inherit' })

  console.log('Extracting...')
  execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}'"`, {
    stdio: 'inherit'
  })

  const sourceBase = join(extractDir, 'resources', 'app')
  const dirsToCopy = [
    'out/vs/base',
    'out/vs/platform',
    'out/vs/editor',
    'out/vs/workbench/api',
    'out/vs/workbench/contrib',
    'out/vs/server'
  ]

  for (const dir of dirsToCopy) {
    const src = join(sourceBase, dir)
    const dest = join(OUTPUT_DIR, dir)
    try {
      await stat(src)
      console.log(`Copying ${dir}...`)
      execSync(`xcopy "${src}" "${dest}" /E /I /Q /Y`, { stdio: 'inherit' })
    } catch {
      console.log(`Skipping ${dir} (not found)`)
    }
  }

  // Create a bootstrap script
  await writeFile(
    join(OUTPUT_DIR, 'bootstrap.js'),
    `// Extension host bootstrap\nrequire('./out/vs/workbench/api/node/extensionHostProcess');\n`
  )

  console.log('Extension host prepared successfully!')
  console.log(`Output: ${OUTPUT_DIR}`)
}

main().catch(console.error)
