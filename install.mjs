// Copies the built plugin into the vault's plugin folder.
import { copyFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const vault = process.env.VAULT ?? join(homedir(), 'Documents', 'Notes')
const target = join(vault, '.obsidian', 'plugins', 'stretch')
mkdirSync(target, { recursive: true })
for (const file of ['main.js', 'manifest.json', 'styles.css']) copyFileSync(file, join(target, file))
console.log(`installed to ${target}`)
