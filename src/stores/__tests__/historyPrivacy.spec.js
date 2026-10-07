import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const preferenceKey = 'dpe_history_preference'
const listingKey = 'dpe_recent_searches'
const nearbyKey = 'recent_dpe_searches'
const oldListing = [{ commune: 'Paris', surface: 65.5, consommation: 173.5, ges: 0 }]
const oldNearby = [{ address: 'Lyon', surface: 42.5, consommation: 120.5, ges: 0 }]
const criteria = { commune: 'Lille', surfaceHabitable: 65.5, consommationEnergie: 173.5, emissionGES: 0 }
let storage
let eventSpy

beforeEach(() => {
  vi.resetModules()
  storage = new Map([
    [listingKey, JSON.stringify(oldListing)],
    [nearbyKey, JSON.stringify(oldNearby)]
  ])
  localStorage.getItem.mockImplementation(key => storage.get(key) ?? null)
  localStorage.setItem.mockImplementation((key, value) => storage.set(key, value))
  localStorage.removeItem.mockImplementation(key => storage.delete(key))
  eventSpy = vi.spyOn(window, 'addEventListener')
})

afterEach(() => {
  for (const [type, listener] of eventSpy.mock.calls) {
    if (type === 'storage') window.removeEventListener(type, listener)
  }
  eventSpy.mockRestore()
})

const createStore = async () => (await import('../useRecherches.js')).useRecherches()

describe('history requires an explicit local opt-in', () => {
  it('checks persisted presence on first use without loading or displaying old entries', async () => {
    const store = await createStore()
    expect(store.historyEnabled.value).toBe(false)
    expect(store.hasSavedSearches.value).toBe(true)
    expect(store.recentSearches.value).toEqual([])
    expect(store.recentDPESearches.value).toEqual([])
    expect(localStorage.getItem.mock.calls).toEqual([[preferenceKey], [listingKey], [nearbyKey]])
    expect(localStorage.setItem).not.toHaveBeenCalled()
    expect(localStorage.removeItem).not.toHaveBeenCalled()
    expect(JSON.parse(storage.get(listingKey))).toEqual(oldListing)
    expect(JSON.parse(storage.get(nearbyKey))).toEqual(oldNearby)
  })

  it('does not read or change history during either search, load, rename or deletion while off', async () => {
    const store = await createStore()
    localStorage.getItem.mockClear()
    expect(store.saveSearch(criteria, 1)).toBe(false)
    expect(store.saveRecentDPESearch({ address: 'Bordeaux' }, { results: [{}] })).toBe(false)
    expect(store.loadRecentSearches()).toEqual([])
    expect(store.loadRecentDPESearches()).toEqual([])
    expect(store.updateSearchDisplayName(0, 'Changed')).toBe(false)
    expect(store.removeSearch(0, 'dpe')).toBe(false)
    expect(localStorage.getItem).not.toHaveBeenCalled()
    expect(localStorage.setItem).not.toHaveBeenCalled()
    expect(localStorage.removeItem).not.toHaveBeenCalled()
  })

  it('restores existing entries only after opt-in and preserves fractional/zero criteria when saving', async () => {
    const store = await createStore()
    expect(store.setHistoryEnabled(true)).toBe(true)
    expect(storage.get(preferenceKey)).toBe('enabled')
    expect(store.recentSearches.value).toEqual(oldListing)
    expect(store.recentDPESearches.value).toEqual(oldNearby)
    expect(store.saveSearch(criteria, 1)).toBe(true)
    expect(store.recentSearches.value[0]).toMatchObject({ surface: 65.5, consommation: 173.5, ges: 0 })
    expect(store.saveRecentDPESearch({ address: 'Bordeaux', surface: 42.5, ges: 0 }, { results: [{}] })).toBe(true)
    expect(store.recentDPESearches.value[0]).toMatchObject({ surface: 42.5, ges: 0 })
  })

  it('hides and stops saving on disable, keeps old entries on disk, and restores them on re-enable', async () => {
    const store = await createStore()
    store.setHistoryEnabled(true)
    store.setHistoryEnabled(false)
    localStorage.getItem.mockClear()
    expect(store.recentSearches.value).toEqual([])
    expect(store.recentDPESearches.value).toEqual([])
    expect(store.saveSearch(criteria, 1)).toBe(false)
    expect(store.saveRecentDPESearch({ address: 'Bordeaux' }, { results: [{}] })).toBe(false)
    expect(localStorage.getItem).not.toHaveBeenCalled()
    expect(localStorage.removeItem).not.toHaveBeenCalled()
    expect(JSON.parse(storage.get(listingKey))).toEqual(oldListing)
    expect(JSON.parse(storage.get(nearbyKey))).toEqual(oldNearby)
    store.setHistoryEnabled(true)
    expect(store.recentSearches.value).toEqual(oldListing)
    expect(store.recentDPESearches.value).toEqual(oldNearby)
  })

  it('restores the choice across reloads only when the explicit preference is enabled', async () => {
    storage.set(preferenceKey, 'enabled')
    const store = await createStore()
    expect(store.historyEnabled.value).toBe(true)
    expect(store.recentSearches.value).toEqual(oldListing)
    expect(store.recentDPESearches.value).toEqual(oldNearby)
    expect(store.hasSavedSearches.value).toBe(true)
  })

  it.each(['disabled', 'true', '1', '{}'])('does not treat %s as opt-in', async value => {
    storage.set(preferenceKey, value)
    const store = await createStore()
    expect(store.historyEnabled.value).toBe(false)
    expect(localStorage.getItem.mock.calls).toEqual([[preferenceKey], [listingKey], [nearbyKey]])
  })

  it('stays off if reading local storage fails', async () => {
    localStorage.getItem.mockImplementation(() => {
      throw new Error('Blocked storage')
    })
    const store = await createStore()
    expect(store.historyEnabled.value).toBe(false)
    expect(store.saveSearch(criteria)).toBe(false)
  })

  it('stays off and does not read history when enabling cannot be saved', async () => {
    const store = await createStore()
    localStorage.setItem.mockImplementation(() => {
      throw new Error('Blocked storage')
    })
    localStorage.getItem.mockClear()
    expect(store.setHistoryEnabled(true)).toBe(false)
    expect(store.historyEnabled.value).toBe(false)
    expect(localStorage.getItem).not.toHaveBeenCalled()
    expect(store.lastError.value).toBe('Blocked storage')
  })

  it('stops saving in this page even if the disabled preference cannot be persisted', async () => {
    const store = await createStore()
    store.setHistoryEnabled(true)
    localStorage.setItem.mockImplementation(() => {
      throw new Error('Blocked storage')
    })
    expect(store.setHistoryEnabled(false)).toBe(false)
    expect(store.historyEnabled.value).toBe(false)
    expect(store.recentSearches.value).toEqual([])
    expect(store.saveSearch(criteria)).toBe(false)
  })

  it('allows explicit clear-all while disabled without first reading or enabling history', async () => {
    const store = await createStore()
    localStorage.getItem.mockClear()
    expect(store.clearSearchHistory('all')).toBe(true)
    expect(storage.has(listingKey)).toBe(false)
    expect(storage.has(nearbyKey)).toBe(false)
    expect(localStorage.getItem).not.toHaveBeenCalled()
    expect(localStorage.setItem).not.toHaveBeenCalled()
    expect(store.historyEnabled.value).toBe(false)
  })

  it('honors another tab disabling history and does not reload old entries', async () => {
    const store = await createStore()
    store.setHistoryEnabled(true)
    storage.set(preferenceKey, 'disabled')
    localStorage.getItem.mockClear()
    window.dispatchEvent(new StorageEvent('storage', { key: preferenceKey, newValue: 'disabled' }))
    expect(store.historyEnabled.value).toBe(false)
    expect(store.recentSearches.value).toEqual([])
    expect(store.recentDPESearches.value).toEqual([])
    expect(store.saveSearch(criteria)).toBe(false)
    expect(localStorage.getItem.mock.calls).toEqual([[preferenceKey], [listingKey], [nearbyKey]])
  })

  it('honors cleared storage in another tab', async () => {
    const store = await createStore()
    store.setHistoryEnabled(true)
    storage.clear()
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
    expect(store.historyEnabled.value).toBe(false)
    expect(store.recentSearches.value).toEqual([])
    expect(store.saveSearch(criteria)).toBe(false)
  })

  it.each([
    [listingKey, 'recentSearches', 'recentDPESearches'],
    [nearbyKey, 'recentDPESearches', 'recentSearches']
  ])(
    'honors another tab clearing %s without restoring deleted entries on the next save',
    async (key, collection, otherCollection) => {
      const store = await createStore()
      store.setHistoryEnabled(true)
      storage.delete(key)
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: null }))
      expect(store[collection].value).toEqual([])
      expect(store[otherCollection].value).toHaveLength(1)
      expect(store.historyEnabled.value).toBe(true)

      if (key === listingKey) store.saveSearch(criteria, 1)
      else store.saveRecentDPESearch({ address: 'Bordeaux', ges: 0 }, { results: [{}] })
      expect(JSON.parse(storage.get(key))).toHaveLength(1)
      expect(store[collection].value[0]).toMatchObject(
        key === listingKey ? { commune: 'Lille' } : { address: 'Bordeaux' }
      )
    }
  )

  it.each([
    [listingKey, 'recentSearches'],
    [nearbyKey, 'recentDPESearches']
  ])('refreshes %s from the current storage value rather than a stale event payload', async (key, collection) => {
    const store = await createStore()
    store.setHistoryEnabled(true)
    const oldValue = storage.get(key)
    // A queued save event must not restore data removed before it is handled.
    storage.set(key, '[]')
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: oldValue }))
    expect(store[collection].value).toEqual([])
  })

  it('refreshes presence on both history-key changes without hydrating or writing history while disabled', async () => {
    const store = await createStore()
    localStorage.getItem.mockClear()
    for (const key of [listingKey, nearbyKey]) {
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: storage.get(key) }))
      storage.delete(key)
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: null }))
    }
    expect(store.recentSearches.value).toEqual([])
    expect(store.recentDPESearches.value).toEqual([])
    expect(store.hasSavedSearches.value).toBe(false)
    expect(localStorage.getItem.mock.calls).toEqual([[listingKey], [listingKey], [nearbyKey], [nearbyKey]])
    expect(localStorage.setItem).not.toHaveBeenCalled()
    expect(localStorage.removeItem).not.toHaveBeenCalled()
  })

  it('ignores invalid stored collections after opt-in without crashing', async () => {
    storage.set(preferenceKey, 'enabled')
    storage.set(listingKey, '{}')
    storage.set(nearbyKey, 'null')
    const store = await createStore()
    expect(store.recentSearches.value).toEqual([])
    expect(store.recentDPESearches.value).toEqual([])
    expect(store.saveSearch(criteria)).toBe(true)
  })
})

describe('persisted search presence', () => {
  it('keeps last-known presence after a transient storage read failure', async () => {
    const store = await createStore()
    expect(store.hasSavedSearches.value).toBe(true)
    localStorage.getItem.mockImplementation(() => {
      throw new Error('Storage blocked')
    })
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
    expect(store.hasSavedSearches.value).toBe(true)
    expect(store.historyEnabled.value).toBe(false)
    expect(store.recentSearches.value).toEqual([])
    expect(store.recentDPESearches.value).toEqual([])
    localStorage.getItem.mockImplementation(key => storage.get(key) ?? null)
    storage.clear()
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
    expect(store.hasSavedSearches.value).toBe(false)
  })

  it.each(['recent', 'dpe'])('does not report a failed first %s save as persisted history', async type => {
    storage.clear()
    const store = await createStore()
    store.setHistoryEnabled(true)
    localStorage.setItem.mockImplementation(() => {
      throw new Error('Storage full')
    })
    const saved =
      type === 'recent'
        ? store.saveSearch(criteria)
        : store.saveRecentDPESearch({ address: 'Bordeaux' }, { results: [] })
    expect(saved).toBe(false)
    expect(store.hasSavedSearches.value).toBe(false)
  })

  it.each([null, '', '[]', '{}', 'null', 'broken JSON'])(
    'ignores missing, empty or invalid histories (%s)',
    async value => {
      storage.clear()
      if (value !== null) {
        storage.set(listingKey, value)
        storage.set(nearbyKey, value)
      }
      const store = await createStore()
      expect(store.hasSavedSearches.value).toBe(false)
      expect(store.historyEnabled.value).toBe(false)
    }
  )

  it.each([listingKey, nearbyKey])('recognizes %s even if the other history is corrupt', async key => {
    storage.set(listingKey, 'broken JSON')
    storage.set(nearbyKey, 'broken JSON')
    storage.set(key, JSON.stringify(key === listingKey ? oldListing : oldNearby))
    storage.set(preferenceKey, 'disabled')
    const store = await createStore()
    expect(store.hasSavedSearches.value).toBe(true)
    expect(store.historyEnabled.value).toBe(false)
    expect(store.recentSearches.value).toEqual([])
    expect(store.recentDPESearches.value).toEqual([])
  })

  it.each(['recent', 'dpe'])('retains persisted presence after a failed last-entry %s deletion', async type => {
    storage.delete(type === 'recent' ? nearbyKey : listingKey)
    const store = await createStore()
    store.setHistoryEnabled(true)
    localStorage.setItem.mockImplementation(() => {
      throw new Error('Storage blocked')
    })
    expect(store.removeSearch(0, type)).toBe(false)
    expect(store.hasSavedSearches.value).toBe(true)
  })

  it('keeps presence after partial clear failure and removes it after a successful retry', async () => {
    const store = await createStore()
    localStorage.removeItem.mockImplementation(key => {
      if (key === nearbyKey) throw new Error('Storage blocked')
      storage.delete(key)
    })
    expect(store.clearSearchHistory()).toBe(false)
    expect(storage.has(listingKey)).toBe(false)
    expect(storage.has(nearbyKey)).toBe(true)
    expect(store.hasSavedSearches.value).toBe(true)
    localStorage.removeItem.mockImplementation(key => storage.delete(key))
    expect(store.clearSearchHistory()).toBe(true)
    expect(store.hasSavedSearches.value).toBe(false)
  })

  it.each([listingKey, nearbyKey])('uses current %s storage, not stale event data, while disabled', async key => {
    storage.clear()
    const store = await createStore()
    const entries = JSON.stringify(key === listingKey ? oldListing : oldNearby)
    storage.set(key, entries)
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: null }))
    expect(store.hasSavedSearches.value).toBe(true)
    storage.set(key, '[]')
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: entries }))
    expect(store.hasSavedSearches.value).toBe(false)
    expect(store.recentSearches.value).toEqual([])
    expect(store.recentDPESearches.value).toEqual([])
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })
})
