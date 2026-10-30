export const PROMINENT_CTF_CATEGORIES = [
  'Web',
  'Crypto',
  'Pwn',
  'Reverse',
  'Forensics',
  'Misc',
  'Other',
] as const

export type ProminentCtfCategory = (typeof PROMINENT_CTF_CATEGORIES)[number]

export interface TeamProgressCategory {
  category: string
  solved: number
  total: number
  percentage: number
}

export interface TeamProgressEvent {
  id: string
  name: string
  startTime: number
  endTime: number
  solved: number
  total: number
}

export interface TeamProgressData {
  totalSolved: number
  totalChallenges: number
  percentage: number
  categories: TeamProgressCategory[]
  events: TeamProgressEvent[]
}

/**
 * Normalizes an arbitrary category string into one of the prominent CTF categories
 * ('Web', 'Crypto', 'Pwn', 'Reverse', 'Forensics', 'Misc', or 'Other').
 */
export function normalizeCtfCategory(raw: string): ProminentCtfCategory {
  if (!raw || typeof raw !== 'string') return 'Other'
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) return 'Other'

  // Web
  if (
    trimmed === 'web' ||
    trimmed.startsWith('web-') ||
    trimmed.startsWith('web/') ||
    trimmed.startsWith('web ') ||
    trimmed.startsWith('web_') ||
    trimmed === 'web exploitation'
  ) {
    return 'Web'
  }

  // Crypto
  if (
    trimmed === 'crypto' ||
    trimmed === 'cryptography' ||
    trimmed.startsWith('crypto-') ||
    trimmed.startsWith('crypto/') ||
    trimmed.startsWith('crypto ') ||
    trimmed.startsWith('crypto_') ||
    trimmed.startsWith('cryptography-') ||
    trimmed.startsWith('cryptography/') ||
    trimmed.startsWith('cryptography ')
  ) {
    return 'Crypto'
  }

  // Pwn / Binary Exploitation
  if (
    trimmed === 'pwn' ||
    trimmed === 'binary' ||
    trimmed === 'binary exploitation' ||
    trimmed.startsWith('pwn-') ||
    trimmed.startsWith('pwn/') ||
    trimmed.startsWith('pwn ') ||
    trimmed.startsWith('pwn_') ||
    trimmed.startsWith('binary exploitation') ||
    trimmed.startsWith('binary-')
  ) {
    return 'Pwn'
  }

  // Reverse / Reverse Engineering
  if (
    trimmed === 'rev' ||
    trimmed === 'reverse' ||
    trimmed === 'reverse engineering' ||
    trimmed === 'reversing' ||
    trimmed.startsWith('rev-') ||
    trimmed.startsWith('rev/') ||
    trimmed.startsWith('rev ') ||
    trimmed.startsWith('rev_') ||
    trimmed.startsWith('reverse-') ||
    trimmed.startsWith('reverse/') ||
    trimmed.startsWith('reverse ') ||
    trimmed.startsWith('reverse_') ||
    trimmed.startsWith('reversing-') ||
    trimmed.startsWith('reverse engineering')
  ) {
    return 'Reverse'
  }

  // Forensics
  if (
    trimmed === 'forensic' ||
    trimmed === 'forensics' ||
    trimmed.startsWith('forensic-') ||
    trimmed.startsWith('forensic/') ||
    trimmed.startsWith('forensic ') ||
    trimmed.startsWith('forensic_') ||
    trimmed.startsWith('forensics-') ||
    trimmed.startsWith('forensics/') ||
    trimmed.startsWith('forensics ') ||
    trimmed.startsWith('forensics_')
  ) {
    return 'Forensics'
  }

  // Misc
  if (
    trimmed === 'misc' ||
    trimmed === 'miscellaneous' ||
    trimmed.startsWith('misc-') ||
    trimmed.startsWith('misc/') ||
    trimmed.startsWith('misc ') ||
    trimmed.startsWith('misc_') ||
    trimmed.startsWith('miscellaneous-') ||
    trimmed.startsWith('miscellaneous/') ||
    trimmed.startsWith('miscellaneous ')
  ) {
    return 'Misc'
  }

  return 'Other'
}

/**
 * Calculates percentage integer (0-100) from solved and total counts.
 */
export function calculateProgressPercentage(
  solved: number,
  total: number
): number {
  if (total <= 0 || !Number.isFinite(total)) return 0
  const ratio = Math.max(0, solved) / total
  return Math.min(100, Math.max(0, Math.round(ratio * 100)))
}

/**
 * Formats percentage as a string e.g. "42%".
 */
export function formatProgressPercentage(percentage: number): string {
  if (!Number.isFinite(percentage)) return '0%'
  return `${Math.min(100, Math.max(0, Math.round(percentage)))}%`
}

/**
 * Formats category percentage directly from solved/total counts.
 */
export function formatCategoryPercentage(
  solved: number,
  total: number
): string {
  return formatProgressPercentage(calculateProgressPercentage(solved, total))
}

/**
 * Formats solved / total count string e.g. "5 / 12 solved".
 */
export function formatProgressCount(solved: number, total: number): string {
  return `${solved} / ${total} solved`
}

/**
 * Calculates overall totals and percentage from an array of category or challenge objects.
 */
export function calculateOverallProgress(
  categories: readonly { solved: number; total: number }[]
): {
  totalSolved: number
  totalChallenges: number
  percentage: number
} {
  let totalSolved = 0
  let totalChallenges = 0
  for (const cat of categories) {
    totalSolved += Math.max(0, cat.solved || 0)
    totalChallenges += Math.max(0, cat.total || 0)
  }
  return {
    totalSolved,
    totalChallenges,
    percentage: calculateProgressPercentage(totalSolved, totalChallenges),
  }
}

/**
 * Finds an active or recent event that still has unsolved challenges.
 * Prioritizes ongoing events (startTime <= now < endTime), followed by the most
 * recently started events.
 */
export function findResumeEvent(
  events: readonly TeamProgressEvent[],
  now = Date.now()
): TeamProgressEvent | null {
  const ongoing = events.filter(
    e => e.total > e.solved && e.startTime <= now && e.endTime > now
  )
  if (ongoing.length > 0) {
    // Sort ongoing events by soonest end time
    return ongoing.slice().sort((a, b) => a.endTime - b.endTime)[0] ?? null
  }

  // Fallback to most recent started event with unsolved challenges
  const recent = events
    .filter(e => e.total > e.solved && e.startTime <= now)
    .sort((a, b) => b.startTime - a.startTime)

  return recent[0] ?? null
}
