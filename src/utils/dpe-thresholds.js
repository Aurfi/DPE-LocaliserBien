export const GES_THRESHOLDS = [
  { classe: 'A', max: 6 },
  { classe: 'B', max: 11 },
  { classe: 'C', max: 30 },
  { classe: 'D', max: 50 },
  { classe: 'E', max: 70 },
  { classe: 'F', max: 100 }
]

export function getGESClass(value) {
  if (value == null) return null
  for (const t of GES_THRESHOLDS) {
    if (value <= t.max) return t.classe
  }
  return 'G'
}

export const ENERGY_THRESHOLDS = [
  { classe: 'A', max: 70 },
  { classe: 'B', max: 110 },
  { classe: 'C', max: 180 },
  { classe: 'D', max: 250 },
  { classe: 'E', max: 330 },
  { classe: 'F', max: 420 }
]

export function getEnergyClass(value) {
  if (value == null) return null
  for (const t of ENERGY_THRESHOLDS) {
    if (value <= t.max) return t.classe
  }
  return 'G'
}
