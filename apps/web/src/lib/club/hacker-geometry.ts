export type HackerThemeKind =
  | 'circuit'
  | 'radar'
  | 'network'
  | 'grid'
  | 'shield'

export type CircuitTrace = {
  d: string
  width: number
  opacity: number
}

export type CircuitVia = {
  cx: number
  cy: number
  r: number
}

export type SmdComponent = {
  x: number
  y: number
  w: number
  h: number
  label: string
}

export type RadarTarget = {
  x: number
  y: number
  label: string
  threat: string
  distance: string
}

export type NetworkNode = {
  id: string
  x: number
  y: number
  name: string
  type: 'core' | 'server' | 'dmz' | 'sensor' | 'vault'
}

export type NetworkLink = {
  x1: number
  y1: number
  x2: number
  y2: number
  type: 'backbone' | 'tunnel' | 'monitor'
  packetX: number
  packetY: number
}

export function hashString(val: string | number): number {
  const str = String(val)
  let h = 2_166_136_261
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16_777_619) >>> 0
  }
  return h
}

export function createPrng(seed: number) {
  let state = seed >>> 0
  function next(range: number): number {
    state = Math.imul(state ^ (state >>> 16), 0x45d9f3b) >>> 0
    state = Math.imul(state ^ (state >>> 16), 0x45d9f3b) >>> 0
    state = (state ^ (state >>> 16)) >>> 0
    return state % range
  }
  function nextFloat(): number {
    return next(10000) / 10000
  }
  return { next, nextFloat }
}

export function resolveHackerTheme(
  seedVal: string | number,
  themeOverride?: HackerThemeKind | 'random'
): HackerThemeKind {
  const themes: HackerThemeKind[] = [
    'circuit',
    'radar',
    'network',
    'grid',
    'shield',
  ]
  if (themeOverride && themeOverride !== 'random') {
    return themeOverride
  }
  const h = hashString(seedVal)
  return themes[h % themes.length]!
}

// 1. PURE CIRCUIT ILLUSTRATION DATA
export function generateCircuitIllustrationData(seedVal: string | number) {
  const seed = hashString(seedVal)
  const prng = createPrng(seed)

  const traces: CircuitTrace[] = []
  const vias: CircuitVia[] = []
  const components: SmdComponent[] = []

  const cx = 500
  const cy = 325

  // Generate PCB 45-degree circuit tracks radiating outward
  const angles = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330]
  for (const deg of angles) {
    const rad = (deg * Math.PI) / 180
    const startR = 120 + prng.next(40)
    const midR = startR + 100 + prng.next(80)
    const endR = midR + 120 + prng.next(140)

    const x0 = cx + startR * Math.cos(rad)
    const y0 = cy + startR * Math.sin(rad)

    const turnRad = rad + (prng.next(2) === 0 ? 0.35 : -0.35)
    const x1 = cx + midR * Math.cos(turnRad)
    const y1 = cy + midR * Math.sin(turnRad)

    const x2 = cx + endR * Math.cos(rad)
    const y2 = cy + endR * Math.sin(rad)

    traces.push({
      d: `M ${x0.toFixed(1)} ${y0.toFixed(1)} L ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`,
      width: 1.5 + prng.nextFloat() * 1.5,
      opacity: 0.25 + prng.nextFloat() * 0.35,
    })

    vias.push({
      cx: Number(x2.toFixed(1)),
      cy: Number(y2.toFixed(1)),
      r: 3 + prng.nextFloat() * 2,
    })

    if (prng.nextFloat() > 0.4) {
      components.push({
        x: Number((x1 - 12).toFixed(1)),
        y: Number((y1 - 6).toFixed(1)),
        w: 24,
        h: 12,
        label: `C${prng.next(90) + 10}`,
      })
    }
  }

  // Symmetrical IC Core Die
  const chipW = 200
  const chipH = 200
  const chipX = cx - chipW / 2
  const chipY = cy - chipH / 2

  return {
    traces,
    vias,
    components,
    chip: {
      x: chipX,
      y: chipY,
      w: chipW,
      h: chipH,
      label: 'UCS QUANTUM CORE',
      sublabel: 'HARDENED SILICON ARCHITECTURE',
    },
  }
}

// 2. PURE RADAR / SONAR ILLUSTRATION DATA
export function generateRadarIllustrationData(seedVal: string | number) {
  const seed = hashString(seedVal)
  const prng = createPrng(seed)

  const cx = 500
  const cy = 325

  const rangeRings = [90, 170, 250, 320]
  const targets: RadarTarget[] = []

  const targetLabels = ['TGT-01', 'TGT-02', 'TGT-03', 'TGT-04', 'TGT-05']
  for (let i = 0; i < 4; i++) {
    const angle = prng.nextFloat() * Math.PI * 2
    const dist = 80 + prng.next(220)
    targets.push({
      x: cx + dist * Math.cos(angle),
      y: cy + dist * Math.sin(angle),
      label: targetLabels[i] ?? `TGT-0${i + 1}`,
      threat: i % 2 === 0 ? 'LOCKED' : 'TRACKING',
      distance: `${(dist * 0.08).toFixed(1)} NM`,
    })
  }

  return {
    cx,
    cy,
    rangeRings,
    targets,
  }
}

// 3. PURE NETWORK CONSTELLATION DATA
export function generateNetworkIllustrationData(seedVal: string | number) {
  const seed = hashString(seedVal)
  const prng = createPrng(seed)

  const nodes: NetworkNode[] = [
    { id: 'gw', x: 500, y: 325, name: 'PRIMARY HUB', type: 'core' },
    { id: 'n1', x: 300, y: 190, name: 'GATEWAY ALPHA', type: 'server' },
    { id: 'n2', x: 700, y: 180, name: 'GATEWAY BETA', type: 'server' },
    { id: 'n3', x: 220, y: 440, name: 'VAULT NODE', type: 'vault' },
    { id: 'n4', x: 780, y: 430, name: 'SENSOR NODE', type: 'sensor' },
    { id: 'n5', x: 500, y: 530, name: 'DMZ SHIELD', type: 'dmz' },
    { id: 'n6', x: 390, y: 100, name: 'BEACON-A', type: 'sensor' },
    { id: 'n7', x: 610, y: 100, name: 'BEACON-B', type: 'sensor' },
  ]

  const links: NetworkLink[] = []
  const connections: [number, number, 'backbone' | 'tunnel' | 'monitor'][] = [
    [0, 1, 'backbone'],
    [0, 2, 'backbone'],
    [0, 3, 'tunnel'],
    [0, 4, 'tunnel'],
    [0, 5, 'backbone'],
    [1, 6, 'monitor'],
    [2, 7, 'monitor'],
    [1, 3, 'tunnel'],
    [2, 4, 'tunnel'],
    [3, 5, 'backbone'],
    [4, 5, 'backbone'],
  ]

  for (const [fromIdx, toIdx, type] of connections) {
    const from = nodes[fromIdx]!
    const to = nodes[toIdx]!
    const progress = 0.2 + prng.nextFloat() * 0.6
    links.push({
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      type,
      packetX: from.x + (to.x - from.x) * progress,
      packetY: from.y + (to.y - from.y) * progress,
    })
  }

  return { nodes, links }
}

// 4. PURE 3D PERSPECTIVE CYBER GRID DATA
export function generateGridIllustrationData(seedVal: string | number) {
  const seed = hashString(seedVal)
  const prng = createPrng(seed)

  const horizonY = 240
  const vanishingX = 500

  // Perspective vertical rays converging to vanishing point
  const rays: { x1: number; y1: number; x2: number; y2: number }[] = []
  for (let x = -300; x <= 1300; x += 65) {
    rays.push({
      x1: vanishingX,
      y1: horizonY,
      x2: x,
      y2: 650,
    })
  }

  // Perspective horizontal cross lines with exponential spacing
  const horizLines: { y: number; opacity: number }[] = []
  let curY = horizonY + 8
  let step = 6
  while (curY <= 650) {
    const depth = (curY - horizonY) / (650 - horizonY)
    horizLines.push({
      y: Number(curY.toFixed(1)),
      opacity: 0.15 + depth * 0.45,
    })
    step = Math.max(7, step * 1.22)
    curY += step
  }

  // Floating Polygonal Cyber Pyramids / Mountains
  const mountains: { pts: string; opacity: number }[] = []
  const m1 = `M 220 ${horizonY} L 320 ${horizonY - 110} L 420 ${horizonY} Z`
  const m2 = `M 580 ${horizonY} L 680 ${horizonY - 130} L 780 ${horizonY} Z`
  const m3 = `M 430 ${horizonY} L 500 ${horizonY - 70} L 570 ${horizonY} Z`
  mountains.push({ pts: m1, opacity: 0.4 }, { pts: m2, opacity: 0.45 }, { pts: m3, opacity: 0.3 })

  return { horizonY, rays, horizLines, mountains }
}

// 5. PURE CYBER SHIELD CREST DATA
export function generateShieldIllustrationData(seedVal: string | number) {
  const seed = hashString(seedVal)
  const prng = createPrng(seed)

  const cx = 500
  const cy = 325

  // Concentric Hexagonal Shield Layers
  function makeHexagon(r: number) {
    const pts: [number, number][] = []
    for (let i = 0; i < 6; i++) {
      const rad = (i * 60 * Math.PI) / 180
      pts.push([cx + r * Math.cos(rad), cy + r * Math.sin(rad)])
    }
    return pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  }

  const hexOuter = makeHexagon(280)
  const hexMid = makeHexagon(210)
  const hexInner = makeHexagon(140)

  // Geometric radial energy spokes
  const spokes: { x1: number; y1: number; x2: number; y2: number }[] = []
  for (let i = 0; i < 12; i++) {
    const rad = (i * 30 * Math.PI) / 180
    spokes.push({
      x1: cx + 70 * Math.cos(rad),
      y1: cy + 70 * Math.sin(rad),
      x2: cx + 270 * Math.cos(rad),
      y2: cy + 270 * Math.sin(rad),
    })
  }

  return {
    cx,
    cy,
    hexOuter,
    hexMid,
    hexInner,
    spokes,
  }
}
