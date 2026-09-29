/**
 * Self-contained build for the dsh-novel-platform bundle.
 *
 * Produces everything `files` ships, without a monorepo checkout:
 * - lib/index.js            Host half (rolldown ESM; @deepseek-ai/* and zod stay external)
 * - lib/client.js           Browser half in the client module system's lazy-CJS
 *                           factory format (`window.__ModuleLoader__.load({id, factory})`),
 *                           externals limited to the PLATFORM_MODULES base,
 *                           CSS Modules compiled by lightningcss and injected
 *                           inside the factory closure
 * - lib/types/types.js      Re-export of the wire vocabulary (committed generated file)
 *
 * lib/typert.* are deterministic generator outputs committed to the repo;
 * regenerate them inside a dsh checkout after changing the controller's wire
 * surface (see README).
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'
import { rolldown } from 'rolldown'
import { transform } from 'lightningcss'
import ts from 'typescript'

const root = fileURLToPath(new URL('..', import.meta.url))
const PACKAGE_ID = '@ccl9295/dsh-novel-platform'

/** The platform seed table (packages/client/web/src/platform.ts). Externals resolve there. */
const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

/** Compile one stylesheet into the tagged style-injection module the factory closure executes. */
function styleInjectionModule(css, tagId, classMap) {
  const lines = [
    `const css = ${JSON.stringify(css)};`,
    `const tagId = ${JSON.stringify(tagId)};`,
    'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\') === null) {',
    '  const tag = document.createElement(\'style\');',
    `  tag.dataset.plugin = ${JSON.stringify(PACKAGE_ID)};`,
    '  tag.dataset.pluginCss = tagId;',
    '  tag.textContent = css;',
    '  document.head.appendChild(tag);',
    '}',
  ]
  if (classMap !== undefined) {
    lines.push(`export default ${JSON.stringify(classMap)};`)
  } else {
    lines.push('export default {};')
  }
  return lines.join('\n')
}

/** The client bundle: lazy-CJS factory with base-only externals and inlined zod. */
async function buildClient() {
  const cssModules = {
    name: 'novel-css-modules',
    resolveId(source, importer) {
      if (!source.endsWith('.module.css')) return null
      const abs = new URL(source, importer !== undefined ? `file://${importer}` : undefined).href
      return `\0css:${abs}.mjs`
    },
    async load(virtualId) {
      if (!virtualId.startsWith('\0css:')) return null
      const file = fileURLToPath(virtualId.slice(5, -4))
      const source = await readFile(file)
      const { code, exports: cssExports } = transform({
        filename: file,
        code: source,
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classMap = {}
      for (const [local, exp] of Object.entries(cssExports ?? {})) classMap[local] = exp.name
      return styleInjectionModule(code.toString(), `${PACKAGE_ID}/${basename(file)}`, classMap)
    },
  }

  const bundle = await rolldown({
    input: join(root, 'src/client/index.ts'),
    cwd: root,
    external: specifier => PLATFORM_MODULES.includes(specifier),
    // The self-referencing generated Remote contribution is inlined into the
    // bundle (no shared runtime identity), exactly as the monorepo's
    // clientBundle preset inlines every `*/remote` wire artifact.
    resolve: {
      alias: {
        'virtual:novel-remote-contribution': pathToFileURL(join(root, 'lib/typert.remote-client.js')).href,
      },
    },
    transform: { ts: { jsx: 'react-jsx' } },
    plugins: [cssModules],
    onwarn(warning) { console.error('[client-warn]', warning.message ?? warning) },
  })
  const { output } = await bundle.generate({
    format: 'cjs',
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_ID)}, factory: (require) => {`,
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    footer: 'return module.exports; } });',
  })
  await bundle.close()
  const chunk = output.find(part => part.fileName === 'client.js')
  if (chunk === undefined) throw new Error('client build produced no client.js chunk')
  const externalRequests = [...String(chunk.code).matchAll(/require\("([^"]+)"\)/g)]
    .map(match => match[1])
    .filter(specifier => !PLATFORM_MODULES.includes(specifier))
  if (externalRequests.length > 0) {
    throw new Error(`client bundle requires non-base modules at runtime: ${[...new Set(externalRequests)].join(', ')} — add them to dsh.client.external or inline them`)
  }
  await writeFile(join(root, 'lib/client.js'), chunk.code)
  return chunk.code.length
}

/** The host bundle: plain ESM, dsh peers and zod stay external for peer resolution. */
async function buildHost() {
  const bundle = await rolldown({
    input: join(root, 'src/index.ts'),
    external: specifier => specifier.startsWith('@deepseek-ai/') || specifier.startsWith('node:') || specifier === 'zod',
    // Lower stage-3 decorators exactly as the dsh build does (TypeScript
    // transpile, matching the typertPlugin lowering): the @Remote controller
    // annotations use the ES decorator context API, which oxc's legacy
    // decorator lowering does not produce.
    transform: { ts: {} },
    plugins: [{
      name: 'novel-ts-decorators',
      transform: {
        filter: { id: /\.ts$/ },
        handler(code, id) {
          if (!/^\s*@/m.test(code)) return null
          const out = ts.transpileModule(code, {
            fileName: id,
            compilerOptions: { target: ts.ScriptTarget.ES2024, module: ts.ModuleKind.ESNext },
          })
          return { code: out.outputText }
        },
      },
    }],
    onwarn() {},
  })
  const { output } = await bundle.generate({ format: 'esm', entryFileNames: 'index.js' })
  await bundle.close()
  const chunk = output.find(part => part.fileName === 'index.js')
  if (chunk === undefined) throw new Error('host build produced no index.js chunk')
  await writeFile(join(root, 'lib/index.js'), chunk.code)
  return chunk.code.length
}

await rm(join(root, 'lib'), { recursive: true, force: true })
await mkdir(join(root, 'lib'), { recursive: true })
for (const file of ['typert.host.js', 'typert.host.d.ts', 'typert.remote-client.js', 'typert.remote-client.d.ts']) {
  // The artifacts are deterministic generator outputs originally emitted
  // under the monorepo package name; restamp them with this package's name.
  const source = await readFile(join(root, 'generated', file), 'utf8')
  await writeFile(join(root, 'lib', file), source.replaceAll('@deepseek-ai/dsh-novel-platform', PACKAGE_ID))
}
await mkdir(join(root, 'lib/types'), { recursive: true })
await writeFile(join(root, 'lib/types/types.js'), 'export {};\n')
await writeFile(
  join(root, 'lib/types/types.d.ts'),
  await readFile(join(root, 'generated/types.d.ts'), 'utf8'),
)
const hostSize = await buildHost()
const clientSize = await buildClient()
console.log(`${PACKAGE_ID}: built lib/index.js (${hostSize} B) and lib/client.js (${clientSize} B)`)
