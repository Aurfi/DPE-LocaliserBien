/** Stable index/search normalization: retain every matching commune, including homonyms. */
export function normalizeCommuneName(value) {
  if (typeof value !== 'string') return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s'’-]/g, '')
}
