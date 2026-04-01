import { config } from '@vue/test-utils'

// Configure Vue Test Utils
config.global.mocks = {
  $t: msg => msg // Mock translations if needed
}

// Setup fetch for tests — serve local data files from disk, external APIs via real fetch
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const originalFetch = global.fetch
const publicDir = resolve(process.cwd(), 'public')

global.fetch = vi.fn((url, options) => {
  // For local data files, read directly from public/ on disk
  if (url.startsWith('/data/')) {
    const filePath = resolve(publicDir, url.slice(1)) // remove leading /
    try {
      const content = readFileSync(filePath, 'utf-8')
      const data = JSON.parse(content)
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(data)
      })
    } catch (_err) {
      return Promise.resolve({
        ok: false,
        status: 404
      })
    }
  }
  // For ADEME API and geo APIs, use real fetch
  if (url.includes('data.ademe.fr') || url.includes('data.geopf.fr') || url.includes('geo.api.gouv.fr')) {
    return originalFetch(url, options)
  }
  // For other URLs, return a rejected promise
  return Promise.reject(new Error(`Unmocked fetch: ${url}`))
})

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
global.localStorage = localStorageMock

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
  localStorageMock.getItem.mockReset()
  localStorageMock.setItem.mockReset()
  localStorageMock.removeItem.mockReset()
  localStorageMock.clear.mockReset()
})
