// Install before navigation. Keep raw entries so baseline/candidate CI artifacts
// can distinguish a genuine improvement from a different load sequence.
export async function observeInitialLayout(page) {
  await page.addInitScript(() => {
    const evidence = {
      supported: PerformanceObserver.supportedEntryTypes.includes('layout-shift'),
      shifts: [],
      states: [],
      firstHeader: null,
      largestContentfulPaint: null
    }
    window.__initialLayout = evidence
    if (evidence.supported) {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          evidence.shifts.push({
            value: entry.value,
            startTime: entry.startTime,
            hadRecentInput: entry.hadRecentInput,
            sources: (entry.sources || []).map(source => ({
              node: source.node ? `${source.node.tagName}.${source.node.className}` : null,
              previousRect: source.previousRect.toJSON(),
              currentRect: source.currentRect.toJSON()
            }))
          })
        }
      }).observe({ type: 'layout-shift', buffered: true })
    }
    if (PerformanceObserver.supportedEntryTypes.includes('largest-contentful-paint')) {
      new PerformanceObserver(list => {
        const entry = list.getEntries().at(-1)
        evidence.largestContentfulPaint = { startTime: entry.startTime, size: entry.size, tag: entry.element?.tagName }
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    }
    new MutationObserver(() => {
      const header = document.querySelector('.site-header')
      if (!header) return
      if (!evidence.firstHeader) evidence.firstHeader = header.getBoundingClientRect().toJSON()
      const state = {
        footer: !!document.querySelector('.site-footer'),
        heading: !!document.querySelector('main h1'),
        form: !!document.querySelector('#search-commune'),
        tabs: !!document.querySelector('nav[aria-label="Type de recherche"]'),
        history: !!document.querySelector('main h2')
      }
      if (JSON.stringify(state) !== JSON.stringify(evidence.states.at(-1))) evidence.states.push(state)
    }).observe(document, { childList: true, subtree: true })
  })
}

export async function initialLayoutReport(page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
  const report = await page.evaluate(() => {
    const evidence = window.__initialLayout
    const rect = selector => document.querySelector(selector)?.getBoundingClientRect().toJSON()
    return {
      ...evidence,
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight },
      header: rect('.site-header'),
      main: rect('main'),
      form: rect('.search-panel'),
      footer: rect('.site-footer'),
      paint: performance.getEntriesByType('paint').map(entry => ({ name: entry.name, startTime: entry.startTime })),
      navigation: performance.getEntriesByType('navigation').map(entry => entry.toJSON())
    }
  })
  return { ...report, cls: largestLayoutShiftSession(report.shifts) }
}

// Match the web-vitals session boundaries (strictly less than 1s / 5s).
// This is a load-window diagnostic, not a field/BFCache implementation.
export function largestLayoutShiftSession(entries) {
  let cls = 0
  let score = 0
  let start = 0
  let previous = 0
  for (const entry of entries) {
    if (entry.hadRecentInput) continue
    if (!score || entry.startTime - previous >= 1000 || entry.startTime - start >= 5000) {
      start = entry.startTime
      score = 0
    }
    score += entry.value
    previous = entry.startTime
    cls = Math.max(cls, score)
  }
  return cls
}
