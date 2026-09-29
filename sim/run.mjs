// Runs a balance script (sim/<name>.ts) against src/game.ts using the esbuild bundled with Vite.
import { transformWithEsbuild } from 'vite'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const entry = process.argv[2] ?? 'sim'
const out = new URL('../node_modules/.cache/ace-sim/', import.meta.url)
await mkdir(out, { recursive: true })
for (const [src, name] of [['../src/game.ts', 'game.mjs'], [`./${entry}.ts`, `${entry}.mjs`]]) {
  const code = await readFile(new URL(src, import.meta.url), 'utf8')
  const { code: js } = await transformWithEsbuild(code, src, { loader: 'ts', format: 'esm' })
  await writeFile(new URL(name, out), js.replaceAll('"../src/game"', '"./game.mjs"').replaceAll("'../src/game'", "'./game.mjs'"))
}
await import(new URL(`${entry}.mjs`, out).href)
