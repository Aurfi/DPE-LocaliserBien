import postcodeDepartments from '../data/geography/postcode-departments.json'
import { normalizeCommuneName } from './normalizeCommuneName.js'

export function hasOwnKey(object, key) {
  // biome-ignore lint/suspicious/noPrototypeBuiltins: Preserve the existing ES2015 browser target without requiring Object.hasOwn.
  return Object.prototype.hasOwnProperty.call(object, key)
}

/** Postal codes are identifiers. Never coerce numbers or invent departments from prefixes. */
export function getDepartmentsFromPostalCode(postalCode) {
  if (typeof postalCode !== 'string' || !/^\d{5}$/.test(postalCode)) return []
  return hasOwnKey(postcodeDepartments, postalCode) ? [...postcodeDepartments[postalCode]] : []
}

/** Load the compact name directory only for name searches, then fetch matching departments only. */
export async function getDepartmentsFromCommuneName(name) {
  const normalized = normalizeCommuneName(name)
  if (!normalized) return []
  const { default: names } = await import('../data/geography/commune-name-departments.json')
  return hasOwnKey(names, normalized) ? [...names[normalized]] : []
}

export { normalizeCommuneName }

export class AmbiguousCommuneError extends Error {
  constructor() {
    super('Plusieurs communes portent ce nom. Précisez le code postal.')
    this.name = 'AmbiguousCommuneError'
    this.code = 'AMBIGUOUS_COMMUNE'
  }
}
