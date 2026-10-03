export function navigationScroll(to, _from, savedPosition) {
  if (savedPosition) return savedPosition
  if (/^#[a-z][a-z0-9_-]*$/i.test(to.hash || '')) return { el: to.hash }
  return { top: 0 }
}
