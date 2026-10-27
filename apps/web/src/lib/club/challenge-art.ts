export type CircuitNode = { cx: number; cy: number; r: number }
export type HexDumpRow = { addr: string; hex: string; ascii: string }
export type MatrixStream = {
  x: number
  y: number
  chars: string[]
  headChar: string
  opacity: number
}
export type RadarReticle = { x: number; y: number; label: string }
export type PinoutPin = {
  label: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export type HackerMotifDetails = {
  telemetry: string[]
  circuitPaths: string[]
  circuitNodes: CircuitNode[]
  hexDumpRows: HexDumpRow[]
  matrixStreams: MatrixStream[]
  radarData: {
    cx: number
    cy: number
    r: number
    sweepAngle: number
    reticles: RadarReticle[]
  }
  pinoutData: {
    chipName: string
    pins: PinoutPin[]
  }
}

export type ChallengeArt = {
  color: string
  motif: number
  x: number
  y: number
  radius: number
  rotation: number
  offset: number
}

export const categoryColors = new Map<string, string>([
  ['web', '#00f0ff'],
  ['crypto', '#facc15'],
  ['cryptography', '#facc15'],
  ['pwn', '#ef4444'],
  ['binary', '#ef4444'],
  ['reverse', '#a855f7'],
  ['rev', '#a855f7'],
  ['forensics', '#00ff66'],
  ['blockchain', '#06b6d4'],
  ['misc', '#f97316'],
  ['ppc', '#8b5cf6'],
  ['koth', '#f43f5e'],
  ['ad', '#ec4899'],
  ['osint', '#6366f1'],
  ['sanity', '#10b981'],
  // Legacy aliases
  ['anby', '#00f0ff'],
  ['billy', '#ef4444'],
  ['ellen', '#a855f7'],
  ['lycaon', '#f97316'],
  ['miyabi', '#facc15'],
  ['nicole', '#00ff66'],
])

export const categoryAliases = new Map<string, string>([
  ['binary', 'pwn'],
  ['rev', 'reverse'],
  ['cryptography', 'crypto'],
  ['anby', 'web'],
  ['billy', 'pwn'],
  ['ellen', 'reverse'],
  ['lycaon', 'misc'],
  ['miyabi', 'crypto'],
  ['nicole', 'forensics'],
])

export const categoryPortraits = new Map<string, string>([
  ['web', 'web'],
  ['crypto', 'crypto'],
  ['cryptography', 'crypto'],
  ['pwn', 'pwn'],
  ['binary', 'pwn'],
  ['reverse', 'reverse'],
  ['rev', 'reverse'],
  ['forensics', 'forensics'],
  ['misc', 'misc'],
  ['blockchain', 'blockchain'],
  ['osint', 'osint'],
  ['koth', 'pwn'],
  ['ad', 'reverse'],
  ['sanity', 'web'],
  ['ppc', 'misc'],
  // Legacy character names
  ['anby', 'anby'],
  ['billy', 'billy'],
  ['ellen', 'ellen'],
  ['lycaon', 'lycaon'],
  ['miyabi', 'miyabi'],
  ['nicole', 'nicole'],
])

const TELEMETRY_POOL = [
  'SEG_0x4F',
  'SYN_ACK',
  '0x7FFF',
  'NX:ENABLED',
  'SEC_ENCLAVE',
  'CANARY:ON',
  'PIE:ACTIVE',
  'ASLR:HIGH',
  '0xDEADBEEF',
  'ROP_READY',
  'PORT:443',
  'SYS_0x3B',
  'MEM_ALLOC',
  'AES_256',
  'TLS_1.3',
  'ZERO_DAY',
  'SHELL_VEC',
  'SIG_VERIFIED',
  'DMA_LOCKED',
  'HEAP_SAFE',
]

const MATRIX_CHARS = '0123456789ABCDEFλ§ΔΩXF7F4A'

export function getChallengeArt(id: string, category: string): ChallengeArt {
  const categoryKey = category.trim().toLowerCase()
  const canonicalCategory = categoryAliases.get(categoryKey) ?? categoryKey
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
    color: categoryColors.get(canonicalCategory) ?? '#00ff66',
    motif: next(5),
    x: 248 + next(96),
    y: 48 + next(79),
    radius: 32 + next(36),
    rotation: next(35) - 17,
    offset: 14 + next(24),
  }
}

export function getHackerMotifDetails(
  id: string,
  category: string,
  canvasWidth = 480,
  rowHeight = 96
): HackerMotifDetails {
  const categoryKey = category.trim().toLowerCase()
  const canonicalCategory = categoryAliases.get(categoryKey) ?? categoryKey
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

  // Pick 3-4 randomized telemetry tags
  const telemetry: string[] = []
  const usedIndexes = new Set<number>()
  for (let i = 0; i < 3; i++) {
    let pick = next(TELEMETRY_POOL.length)
    while (usedIndexes.has(pick)) {
      pick = (pick + 1) % TELEMETRY_POOL.length
    }
    usedIndexes.add(pick)
    telemetry.push(TELEMETRY_POOL[pick] ?? 'SYS_OK')
  }

  // Motif 0: Digital Circuit Traces
  const circuitPaths: string[] = []
  const circuitNodes: CircuitNode[] = []
  const traceCount = 4 + next(3)
  for (let i = 0; i < traceCount; i++) {
    const startX = 20 + next(100)
    const startY = 15 + next(65)
    const midX1 = startX + 40 + next(80)
    const dy = (next(2) === 0 ? 1 : -1) * (15 + next(25))
    const midY = Math.max(10, Math.min(rowHeight - 15, startY + dy))
    const midX2 = midX1 + Math.abs(dy)
    const endX = midX2 + 60 + next(120)

    circuitPaths.push(
      `M ${startX} ${startY} H ${midX1} L ${midX2} ${midY} H ${endX}`
    )
    circuitNodes.push({ cx: startX, cy: startY, r: 2.2 })
    circuitNodes.push({ cx: endX, cy: midY, r: 2.2 })
    if (next(2) === 0) {
      circuitNodes.push({ cx: midX1, cy: startY, r: 1.5 })
    }
  }

  // Motif 1: Hex Memory Dump Rows
  const hexDumpRows: HexDumpRow[] = []
  const baseAddr = 0x401000 + next(0x2000)
  for (let i = 0; i < 4; i++) {
    const rowAddr = `0x${(baseAddr + i * 16).toString(16).toUpperCase()}`
    let hexStr = ''
    let asciiStr = ''
    for (let b = 0; b < 8; b++) {
      const byteVal = next(256)
      const h = byteVal.toString(16).padStart(2, '0').toUpperCase()
      hexStr += (b === 0 ? '' : ' ') + h
      asciiStr +=
        byteVal >= 32 && byteVal <= 126 ? String.fromCharCode(byteVal) : '.'
    }
    hexDumpRows.push({ addr: rowAddr, hex: hexStr, ascii: asciiStr })
  }

  // Motif 2: Cyber Matrix Rain Streams
  const matrixStreams: MatrixStream[] = []
  const colCount = 6 + next(3)
  for (let i = 0; i < colCount; i++) {
    const colX = 30 + i * 65 + next(25)
    const colY = 8 + next(20)
    const len = 3 + next(4)
    const chars: string[] = []
    for (let c = 0; c < len; c++) {
      chars.push(MATRIX_CHARS[next(MATRIX_CHARS.length)] ?? '0')
    }
    const headChar = MATRIX_CHARS[next(MATRIX_CHARS.length)] ?? '1'
    const opacity = 0.35 + next(35) / 100
    matrixStreams.push({ x: colX, y: colY, chars, headChar, opacity })
  }

  // Motif 3: Tactical Radar Crosshairs
  const radarSweepAngle = next(360)
  const radarReticles: RadarReticle[] = [
    { x: 310 + next(70), y: 25 + next(35), label: `TGT_${next(99)}` },
    { x: 260 + next(80), y: 55 + next(30), label: `LOCK_${next(99)}` },
  ]
  const radarData = {
    cx: Math.min(canvasWidth - 100, 320 + next(50)),
    cy: 48 + next(15),
    r: 42 + next(18),
    sweepAngle: radarSweepAngle,
    reticles: radarReticles,
  }

  // Motif 4: Microprocessor Pinouts
  const chipNames = ['UCS-SEC-64', 'USTH-SOC-26', 'HSM-RISCV', 'ENCLAVE-V2']
  const pinLabels = [
    'VCC',
    'GND',
    'CLK',
    'TX',
    'RX',
    'RST',
    'IRQ',
    'INT',
    'SDA',
    'SCL',
    'MISO',
    'MOSI',
  ]
  const chipName = chipNames[next(chipNames.length)] ?? 'UCS-CORE'
  const pins: PinoutPin[] = []
  const pinCount = 6
  for (let p = 0; p < pinCount; p++) {
    const py = 20 + p * 11
    pins.push({
      label: pinLabels[p % pinLabels.length] ?? 'PIN',
      x1: 265,
      y1: py,
      x2: 245 - next(15),
      y2: py,
    })
    pins.push({
      label: pinLabels[(p + 6) % pinLabels.length] ?? 'PIN',
      x1: 375,
      y1: py,
      x2: 395 + next(15),
      y2: py,
    })
  }
  const pinoutData = {
    chipName,
    pins,
  }

  return {
    telemetry,
    circuitPaths,
    circuitNodes,
    hexDumpRows,
    matrixStreams,
    radarData,
    pinoutData,
  }
}
