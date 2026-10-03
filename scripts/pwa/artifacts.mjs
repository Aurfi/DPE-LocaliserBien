import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

// Read generated Workbox data; never execute the worker in Node or rewrite it.
export function parsePrecache(worker) {
  const source = worker.match(/\.precacheAndRoute\((\[[\s\S]*?\]),\s*\{/)?.[1]
  if (!source) throw new Error('Unsupported generated Workbox manifest: no precacheAndRoute array')
  const entries = JSON.parse(source.replace(/([{,]\s*)(url|revision)\s*:/g, '$1"$2":'))
  const urls = new Set()
  for (const entry of entries) {
    if (
      typeof entry.url !== 'string' ||
      !/^[a-zA-Z0-9_./-]+$/.test(entry.url) ||
      entry.url.startsWith('/') ||
      entry.url.split('/').some(part => !part || part === '.' || part === '..') ||
      !(entry.revision === null || /^[a-f0-9]+$/.test(entry.revision)) ||
      urls.has(entry.url)
    ) {
      throw new Error('Invalid or duplicate precache entry')
    }
    urls.add(entry.url)
  }
  if (!urls.has('index.html')) throw new Error('Missing precached index.html')
  return entries
}

export async function readRelease(directory, { includeHidden = false } = {}) {
  const root = path.resolve(directory)
  const files = new Map()
  async function walk(current, prefix = '') {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error(`Build symlink forbidden: ${entry.name}`)
      const relative = `${prefix}${entry.name}`
      if (entry.isDirectory()) await walk(path.join(current, entry.name), `${relative}/`)
      else if (entry.isFile() && (includeHidden || !entry.name.startsWith('.'))) {
        const bytes = await readFile(path.join(root, relative))
        files.set(relative, { bytes, sha256: sha256(bytes) })
      }
    }
  }
  if (!(await stat(root)).isDirectory()) throw new Error('Build directory required')
  await walk(root)
  const index = files.get('index.html')
  const sw = files.get('sw.js')
  if (!index || !sw) throw new Error('A real production build with index.html and sw.js is required')
  const moduleUrl = index.bytes.toString().match(/<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/)?.[1]
  if (!moduleUrl?.startsWith('/assets/') || !files.has(moduleUrl.slice(1))) {
    throw new Error('Missing built entry module')
  }
  const precache = parsePrecache(sw.bytes.toString()).map(entry => {
    const file = files.get(entry.url)
    if (!file) throw new Error(`Missing precache asset: ${entry.url}`)
    if (entry.revision !== null && createHash('md5').update(file.bytes).digest('hex') !== entry.revision) {
      throw new Error(`Precache revision does not match bytes: ${entry.url}`)
    }
    return { ...entry, sha256: file.sha256 }
  })
  if (!precache.some(entry => entry.url === moduleUrl.slice(1))) {
    throw new Error('Built entry module is not precached')
  }
  return {
    files,
    descriptor: {
      indexSha256: index.sha256,
      swSha256: sw.sha256,
      moduleUrl,
      precache,
      files: [...files]
        .map(([file, data]) => ({ file, sha256: data.sha256 }))
        .sort((a, b) => a.file.localeCompare(b.file))
    }
  }
}

export function expectedCacheEntries(descriptor, origin) {
  return descriptor.precache
    .map(entry => {
      const url = new URL(entry.url, `${origin}/`)
      if (entry.revision !== null) url.searchParams.set('__WB_REVISION__', entry.revision)
      return { url: url.href, sha256: entry.sha256 }
    })
    .sort((a, b) => a.url.localeCompare(b.url))
}
