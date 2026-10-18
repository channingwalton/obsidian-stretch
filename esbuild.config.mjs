import esbuild from 'esbuild'
import process from 'node:process'

const production = process.argv[2] === 'production'

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*'],
  format: 'cjs',
  target: 'es2020',
  platform: 'browser',
  logLevel: 'info',
  sourcemap: production ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
})

if (production) {
  await context.rebuild()
  process.exit(0)
} else {
  await context.watch()
}
