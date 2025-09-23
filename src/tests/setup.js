import { config } from '@vue/test-utils'

// Configure Vue Test Utils
config.global.mocks = {
  $t: msg => msg // Mock translations if needed
}

// Setup fetch for tests
const originalFetch = global.fetch
global.fetch = vi.fn((url, options) => {
  // For local data files in CI, return empty data since no dev server
  if (url.startsWith('/data/departments/')) {
    // In CI environment, return empty response
    if (process.env.CI) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
      })
    }
    // In local dev, try to use the real dev server
    return originalFetch(`http://localhost:3000${url}`, options).catch(() => ({
      ok: true,
      json: () => Promise.resolve([])
    }))
  }
  // For ADEME API, use real fetch
  if (url.includes('data.ademe.fr')) {
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
