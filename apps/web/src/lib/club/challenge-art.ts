export type ChallengeArt = {
  color: string
  motif: number
  x: number
  y: number
  radius: number
  rotation: number
  offset: number
}

const categoryColors = new Map([
  ['web', '#8baec4'],
  ['crypto', '#c9bc87'],
  ['pwn', '#bc959b'],
  ['reverse', '#c7a48a'],
  ['forensics', '#9bb694'],
  ['blockchain', '#89b8ad'],
  ['misc', '#aa9bbf'],
  ['ppc', '#b89db7'],
  ['koth', '#b59da7'],
  ['ad', '#c097a5'],
  ['osint', '#aab6c1'],
  ['sanity', '#a9b4ac'],
])

const aliases = new Map([
  ['binary', 'pwn'],
  ['rev', 'reverse'],
  ['cryptography', 'crypto'],
])

/** Only bounded numbers and a fixed palette reach SVG attributes. */
export function getChallengeArt(id: string, category: string): ChallengeArt {
  const categoryKey = category.trim().toLowerCase()
  const canonicalCategory = aliases.get(categoryKey) ?? categoryKey
  const key = `${canonicalCategory}\0${id}`
  let state = 2_166_136_261
  for (let index = 0; index < key.length; index++) {
    state = Math.imul(state ^ key.charCodeAt(index), 16_777_619) >>> 0
  }

  function next(range: number): number {
    state = Math.imul(state ^ (state >>> 16), 0x45d9f3b) >>> 0
    state = Math.imul(state ^ (state >>> 16), 0x45d9f3b) >>> 0
    state = (state ^ (state >>> 16)) >>> 0
    return state % range
  }

  return {
    color: categoryColors.get(canonicalCategory) ?? '#97a9a3',
    motif: next(3),
    x: 248 + next(96),
    y: 48 + next(79),
    radius: 32 + next(36),
    rotation: next(35) - 17,
    offset: 14 + next(24),
  }
}
