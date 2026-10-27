<script lang="ts">
  import {
    hashString,
    resolveHackerTheme,
    generateCircuitIllustrationData,
    generateRadarIllustrationData,
    generateNetworkIllustrationData,
    generateGridIllustrationData,
    generateShieldIllustrationData,
    type HackerThemeKind,
  } from '$lib/club/hacker-geometry'
  import { categoryColors, categoryAliases } from '$lib/club/challenge-art'

  type Props = {
    seed?: string | number
    theme?: HackerThemeKind | 'random'
    category?: string
    opacity?: number
    class?: string
  }

  let {
    seed = 'ucs-default-core',
    theme,
    category = '',
    opacity = 0.65,
    class: className = '',
  }: Props = $props()

  const id = $props.id()
  const themeKind = $derived(resolveHackerTheme(seed, theme))

  const catKey = $derived(category.trim().toLowerCase())
  const canonicalCat = $derived(categoryAliases.get(catKey) ?? catKey)
  const accentColor = $derived(
    categoryColors.get(canonicalCat) ?? 'var(--club-lime, #00ff66)'
  )

  const circuitData = $derived(
    themeKind === 'circuit' ? generateCircuitIllustrationData(seed) : null
  )
  const radarData = $derived(
    themeKind === 'radar' ? generateRadarIllustrationData(seed) : null
  )
  const networkData = $derived(
    themeKind === 'network' ? generateNetworkIllustrationData(seed) : null
  )
  const gridData = $derived(
    themeKind === 'grid' ? generateGridIllustrationData(seed) : null
  )
  const shieldData = $derived(
    themeKind === 'shield' ? generateShieldIllustrationData(seed) : null
  )
</script>

<svg
  class="detail-geometry {className}"
  viewBox="0 0 1000 650"
  preserveAspectRatio="xMidYMid slice"
  style:--geometry-opacity={opacity}
  style:--theme-accent={accentColor}
  aria-hidden="true"
  focusable="false"
>
  <defs>
    <!-- Background cyber grid -->
    <pattern
      id={`${id}-hacker-grid`}
      width="40"
      height="40"
      patternUnits="userSpaceOnUse"
    >
      <path
        d="M 40 0 L 0 0 0 40"
        fill="none"
        stroke="currentColor"
        stroke-opacity="0.07"
        stroke-width="0.8"
      />
      <circle cx="0" cy="0" r="0.9" fill="currentColor" opacity="0.18" />
    </pattern>

    <!-- Deep Cyber Gradient Wash -->
    <linearGradient id={`${id}-hacker-wash`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="var(--detail-wash-start)" />
      <stop offset="100%" stop-color="var(--detail-wash-end)" />
    </linearGradient>

    <!-- Glowing Accent Filter -->
    <filter id={`${id}-cyber-glow`} x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <!-- Radar Sweep Conic Gradient -->
    {#if themeKind === 'radar'}
      <linearGradient id={`${id}-radar-sweep`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="var(--theme-accent)" stop-opacity="0.32" />
        <stop offset="60%" stop-color="var(--theme-accent)" stop-opacity="0.08" />
        <stop offset="100%" stop-color="var(--theme-accent)" stop-opacity="0" />
      </linearGradient>
    {/if}
  </defs>

  <!-- Deep Wash and Grid -->
  <rect width="1000" height="650" fill={`url(#${id}-hacker-wash)`} />
  <rect width="1000" height="650" fill={`url(#${id}-hacker-grid)`} />

  <!-- Tactical Corner Registration Marks -->
  <g class="corner-brackets" stroke="currentColor" stroke-width="1.2" opacity="0.35" fill="none">
    <!-- Top-Left -->
    <path d="M 20 45 V 20 H 45" />
    <circle cx="20" cy="20" r="2" fill="currentColor" />
    <!-- Top-Right -->
    <path d="M 980 45 V 20 H 955" />
    <circle cx="980" cy="20" r="2" fill="currentColor" />
    <!-- Bottom-Left -->
    <path d="M 20 605 V 630 H 45" />
    <circle cx="20" cy="630" r="2" fill="currentColor" />
    <!-- Bottom-Right -->
    <path d="M 980 605 V 630 H 955" />
    <circle cx="980" cy="630" r="2" fill="currentColor" />
  </g>

  <!-- THEME 1: PURE CIRCUIT NEXUS ILLUSTRATION -->
  {#if themeKind === 'circuit' && circuitData}
    <g class="hacker-theme-circuit" stroke="currentColor" fill="none">
      <!-- Copper PCB Traces -->
      {#each circuitData.traces as trace}
        <path
          d={trace.d}
          stroke-width={trace.width}
          opacity={trace.opacity}
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      {/each}

      <!-- Solder Vias with Concentric Rings -->
      {#each circuitData.vias as via}
        <circle cx={via.cx} cy={via.cy} r={via.r} fill="currentColor" opacity="0.5" />
        <circle cx={via.cx} cy={via.cy} r={via.r + 2.5} stroke-width="0.7" opacity="0.3" />
      {/each}

      <!-- SMD Passive Components -->
      {#each circuitData.components as comp}
        <rect
          x={comp.x}
          y={comp.y}
          width={comp.w}
          height={comp.h}
          rx="2"
          stroke-width="1"
          opacity="0.4"
          fill="var(--detail-wash-end)"
        />
      {/each}

      <!-- Central Quantum Microprocessor Die -->
      <g class="microprocessor-package">
        <!-- Outer package frame -->
        <rect
          x={circuitData.chip.x}
          y={circuitData.chip.y}
          width={circuitData.chip.w}
          height={circuitData.chip.h}
          rx="8"
          stroke-width="2"
          stroke="var(--theme-accent)"
          opacity="0.6"
          fill="var(--detail-wash-end)"
        />
        <!-- Inner die border -->
        <rect
          x={circuitData.chip.x + 18}
          y={circuitData.chip.y + 18}
          width={circuitData.chip.w - 36}
          height={circuitData.chip.h - 36}
          rx="4"
          stroke-width="1"
          stroke="currentColor"
          opacity="0.3"
        />
        <!-- Die Core Concentric Energy Rings -->
        <circle
          cx={circuitData.chip.x + circuitData.chip.w / 2}
          cy={circuitData.chip.y + circuitData.chip.h / 2}
          r="48"
          stroke="var(--theme-accent)"
          stroke-width="2"
          opacity="0.7"
        />
        <circle
          cx={circuitData.chip.x + circuitData.chip.w / 2}
          cy={circuitData.chip.y + circuitData.chip.h / 2}
          r="24"
          fill="var(--theme-accent)"
          opacity="0.5"
        />
      </g>
    </g>

  <!-- THEME 2: PURE TACTICAL RADAR & SONAR ILLUSTRATION -->
  {:else if themeKind === 'radar' && radarData}
    <g class="hacker-theme-radar">
      <g class="radar-scope" stroke="currentColor" fill="none">
        <!-- Range Rings -->
        {#each radarData.rangeRings as ring}
          <circle
            cx={radarData.cx}
            cy={radarData.cy}
            r={ring}
            stroke-width="1"
            stroke-dasharray={ring === 250 ? 'none' : '4 4'}
            opacity="0.25"
          />
        {/each}
        <circle
          cx={radarData.cx}
          cy={radarData.cy}
          r="340"
          stroke-width="2"
          stroke="var(--theme-accent)"
          opacity="0.5"
        />

        <!-- Radar Rotating Sweep Wedge -->
        <g class="radar-sweep-group">
          <path
            d={`M ${radarData.cx} ${radarData.cy} L ${radarData.cx + 340} ${radarData.cy} A 340 340 0 0 1 ${radarData.cx + 240} ${radarData.cy + 240} Z`}
            fill={`url(#${id}-radar-sweep)`}
            stroke="none"
          />
        </g>

        <!-- Azimuth Crosshair Axes -->
        <line x1={radarData.cx - 360} y1={radarData.cy} x2={radarData.cx + 360} y2={radarData.cy} stroke-width="0.8" opacity="0.3" />
        <line x1={radarData.cx} y1={radarData.cy - 340} x2={radarData.cx} y2={radarData.cy + 340} stroke-width="0.8" opacity="0.3" />

        <!-- Detected Radar Targets -->
        {#each radarData.targets as tgt}
          <g class="radar-blip">
            <circle cx={tgt.x} cy={tgt.y} r="6" stroke="var(--theme-accent)" stroke-width="1.5" opacity="0.85" />
            <circle cx={tgt.x} cy={tgt.y} r="2" fill="var(--theme-accent)" opacity="1" />
            <rect x={tgt.x - 12} y={tgt.y - 12} width="24" height="24" stroke="var(--theme-accent)" stroke-width="0.8" opacity="0.5" stroke-dasharray="2 2" />
          </g>
        {/each}
      </g>
    </g>

  <!-- THEME 3: PURE NETWORK CONSTELLATION ILLUSTRATION -->
  {:else if themeKind === 'network' && networkData}
    <g class="hacker-theme-network" stroke="currentColor" fill="none">
      <!-- Network Links -->
      {#each networkData.links as link}
        <line
          x1={link.x1}
          y1={link.y1}
          x2={link.x2}
          y2={link.y2}
          stroke-width={link.type === 'backbone' ? '2.5' : '1.2'}
          opacity={link.type === 'backbone' ? '0.45' : '0.22'}
          stroke-dasharray={link.type === 'monitor' ? '3 3' : 'none'}
        />
        <!-- Moving Data Packet Node -->
        <circle
          cx={link.packetX}
          cy={link.packetY}
          r="4.5"
          fill="var(--theme-accent)"
          stroke="none"
          opacity="0.9"
          filter={`url(#${id}-cyber-glow)`}
        />
      {/each}

      <!-- Network Topology Nodes -->
      {#each networkData.nodes as node}
        <g class="network-node">
          <circle
            cx={node.x}
            cy={node.y}
            r={node.type === 'core' ? '28' : '18'}
            fill="var(--detail-wash-end)"
            stroke="var(--theme-accent)"
            stroke-width={node.type === 'core' ? '3' : '1.8'}
            opacity="0.8"
          />
          <circle
            cx={node.x}
            cy={node.y}
            r={node.type === 'core' ? '14' : '8'}
            fill="var(--theme-accent)"
            opacity="0.6"
          />
        </g>
      {/each}
    </g>

  <!-- THEME 4: PURE 3D PERSPECTIVE CYBER GRID ILLUSTRATION -->
  {:else if themeKind === 'grid' && gridData}
    <g class="hacker-theme-grid" stroke="currentColor" fill="none">
      <!-- Horizon Energy Glow -->
      <line
        x1="0"
        y1={gridData.horizonY}
        x2="1000"
        y2={gridData.horizonY}
        stroke="var(--theme-accent)"
        stroke-width="3"
        opacity="0.75"
        filter={`url(#${id}-cyber-glow)`}
      />

      <!-- Floating Polygonal Cyber Mountains -->
      {#each gridData.mountains as m}
        <path
          d={m.pts}
          fill="var(--detail-wash-end)"
          stroke="var(--theme-accent)"
          stroke-width="1.5"
          opacity={m.opacity}
        />
      {/each}

      <!-- Perspective Vertical Rays -->
      {#each gridData.rays as ray}
        <line
          x1={ray.x1}
          y1={ray.y1}
          x2={ray.x2}
          y2={ray.y2}
          stroke-width="1"
          opacity="0.28"
        />
      {/each}

      <!-- Perspective Horizontal Lines -->
      {#each gridData.horizLines as hl}
        <line
          x1="0"
          y1={hl.y}
          x2="1000"
          y2={hl.y}
          stroke-width="1.2"
          opacity={hl.opacity}
        />
      {/each}
    </g>

  <!-- THEME 5: PURE SACRED CYBER SHIELD CREST ILLUSTRATION -->
  {:else if themeKind === 'shield' && shieldData}
    <g class="hacker-theme-shield" stroke="currentColor" fill="none">
      <!-- Hexagonal Shield Layers -->
      <polygon
        points={shieldData.hexOuter}
        stroke="var(--theme-accent)"
        stroke-width="2.5"
        opacity="0.4"
      />
      <polygon
        points={shieldData.hexMid}
        stroke="currentColor"
        stroke-width="1.5"
        opacity="0.3"
        stroke-dasharray="6 4"
      />
      <polygon
        points={shieldData.hexInner}
        stroke="var(--theme-accent)"
        stroke-width="3"
        fill="var(--detail-wash-end)"
        opacity="0.7"
      />

      <!-- Central Shield Core -->
      <circle
        cx={shieldData.cx}
        cy={shieldData.cy}
        r="45"
        fill="var(--theme-accent)"
        opacity="0.6"
        filter={`url(#${id}-cyber-glow)`}
      />
      <circle
        cx={shieldData.cx}
        cy={shieldData.cy}
        r="22"
        fill="#ffffff"
        opacity="0.9"
      />

      <!-- Radial Spokes -->
      {#each shieldData.spokes as spoke}
        <line
          x1={spoke.x1}
          y1={spoke.y1}
          x2={spoke.x2}
          y2={spoke.y2}
          stroke-width="1.2"
          opacity="0.25"
        />
      {/each}
    </g>
  {/if}
</svg>

<style>
  .detail-geometry {
    --detail-wash-start: light-dark(#ffffff, #090e0c);
    --detail-wash-end: light-dark(#e9ece0, #131e18);
    position: absolute;
    inset: 0;
    z-index: -1;
    inline-size: 100%;
    block-size: 100%;
    color: var(--club-accent-text, #00ff66);
    opacity: var(--geometry-opacity, 0.65);
    pointer-events: none;
    user-select: none;
  }

  :global(:root[data-theme='light']) .detail-geometry {
    --detail-wash-start: #f4f6ee;
    --detail-wash-end: #dce4c8;
  }

  .radar-sweep-group {
    transform-origin: 500px 325px;
    animation: radar-sweep-rotate 10s linear infinite;
  }

  @keyframes radar-sweep-rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .radar-sweep-group {
      animation: none;
    }
  }
</style>
