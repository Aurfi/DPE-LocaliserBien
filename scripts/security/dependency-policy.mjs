// Removing an audit exception must never remove the browser build boundary.
export const RETIRED_PACKAGES = ['braces', 'chokidar', 'fast-glob', 'micromatch', 'tailwindcss', 'vite-plugin-html']
export const BUILD_TOOL_PACKAGES = [
  '@vitejs/plugin-vue',
  'autoprefixer',
  'postcss',
  'rollup',
  'rollup-plugin-visualizer',
  'terser',
  'vite',
  'vite-plugin-pwa',
  'workbox-build'
]

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value)

export function validatePolicy(policy) {
  const failures = []
  if (
    !isRecord(policy) ||
    policy.schemaVersion !== 2 ||
    Object.keys(policy).some(key => !['schemaVersion', 'retiredPackages', 'buildToolRuntimePackages'].includes(key))
  ) {
    return ['Invalid dependency policy; advisory exceptions are not supported.']
  }
  for (const [field, required] of [
    ['retiredPackages', RETIRED_PACKAGES],
    ['buildToolRuntimePackages', [...RETIRED_PACKAGES, ...BUILD_TOOL_PACKAGES]]
  ]) {
    const names = policy[field]
    if (
      !Array.isArray(names) ||
      names.some(name => typeof name !== 'string' || !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(name)) ||
      new Set(names).size !== names.length ||
      required.some(name => !names.includes(name))
    ) {
      failures.push(`Invalid or incomplete ${field} policy.`)
    }
  }
  return failures
}

export function packageNamesInId(id) {
  const normalized = id.replaceAll('\\', '/').replaceAll('\0', '')
  const names = [...normalized.matchAll(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/?#]+)/g)].map(match => match[1])
  // Bare static and dynamic imports, including package subpaths and Vite suffixes.
  const bare = normalized.match(/^((?:@[^/]+\/)?[^./@\s][^/?#]*)(?:[/?#]|$)/)
  if (bare) names.push(bare[1])
  return names
}
