import { isRecord, packageNamesInId, validatePolicy } from './dependency-policy.mjs'

// Vite emits these two browser shims as virtual modules, not compiler imports.
const browserHelpers = new Set(['\0vite/preload-helper.js', '\0vite/modulepreload-polyfill.js'])

// This boundary is independent of the audit result and dependency classification.
// Build tooling must not become browser code merely by moving its declaration.
export function assertNoBuildToolRuntimeModules(bundle, policy) {
  const failures = validatePolicy(policy)
  if (failures.length) throw new Error(failures.join('\n'))
  if (!isRecord(bundle)) throw new Error('Invalid browser output bundle.')
  const tooling = new Set(policy.buildToolRuntimePackages)
  const violations = []
  for (const [file, output] of Object.entries(bundle)) {
    if (!isRecord(output)) throw new Error(`Invalid browser output: ${file}.`)
    if (output.type === 'asset') continue
    if (
      output.type !== 'chunk' ||
      !isRecord(output.modules) ||
      !Array.isArray(output.imports) ||
      !Array.isArray(output.dynamicImports)
    ) {
      throw new Error(`Invalid browser output chunk: ${file}.`)
    }
    for (const id of [...Object.keys(output.modules), output.facadeModuleId].filter(Boolean)) {
      if (typeof id !== 'string') throw new Error(`Invalid module identity in ${file}.`)
      if (browserHelpers.has(id)) continue
      if (packageNamesInId(id).some(name => tooling.has(name))) violations.push(`${file}: module ${id}`)
    }
    for (const imported of [...output.imports, ...output.dynamicImports]) {
      if (typeof imported !== 'string') throw new Error(`Invalid import identity in ${file}.`)
      if (packageNamesInId(imported).some(name => tooling.has(name))) {
        violations.push(`${file}: external import ${imported}`)
      }
    }
  }
  if (violations.length) {
    throw new Error(`Build tooling crossed into browser output:\n${violations.join('\n')}`)
  }
}

// Evidence stays outside dist. This is the Rollup output graph, not a claim about
// static assets copied from public or service-worker files emitted afterward.
export function runtimeModuleGraph(bundle, root) {
  const prefix = `${root.replaceAll('\\', '/').replace(/\/$/, '')}/`
  const normalize = id => id.replaceAll('\\', '/').replaceAll(prefix, '<root>/')
  const chunks = Object.entries(bundle)
    .filter(([, output]) => output.type === 'chunk')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([file, output]) => ({
      file,
      isEntry: output.isEntry,
      isDynamicEntry: output.isDynamicEntry,
      facadeModuleId: output.facadeModuleId ? normalize(output.facadeModuleId) : null,
      modules: Object.keys(output.modules).map(normalize).sort(),
      imports: [...output.imports].map(normalize).sort(),
      dynamicImports: [...output.dynamicImports].map(normalize).sort()
    }))
  return {
    schemaVersion: 1,
    scope: 'Rollup browser output; excludes later generated service-worker files and copied public assets.',
    publicJavaScript: Object.keys(bundle)
      .filter(file => /\.(?:m?js|cjs)$/.test(file))
      .sort(),
    chunks
  }
}
