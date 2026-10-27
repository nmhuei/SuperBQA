<script lang="ts">
  import {
    getChallengeArt,
    categoryPortraits,
    categoryAliases,
  } from '$lib/club/challenge-art'

  type Props = { id: string; category: string; index?: number; count?: number }
  let { id, category, index = 0, count = 1 }: Props = $props()
  let width = $state(0)
  let height = $state(0)

  const catKey = $derived(category.trim().toLowerCase())
  const canonicalCategory = $derived(categoryAliases.get(catKey) ?? catKey)
  const portrait = $derived(categoryPortraits.get(catKey) ?? 'lycaon')

  const art = $derived(getChallengeArt(id, category))
  const color = $derived(art.color)
  const canvasWidth = $derived(width || 480)
  const rowHeight = $derived(height || 96)
  const stripStart = $derived(Math.floor(index / 6) * 6)
  const stripRows = $derived(Math.max(1, Math.min(6, count - stripStart)))
  const canvasHeight = $derived(rowHeight * stripRows)
  const offset = $derived((index % 6) * rowHeight)

  const imageWidth = $derived(Math.max(canvasWidth * 1.12, canvasHeight * 1.7))
  const imageHeight = $derived((imageWidth * 1369) / 1297)
  const imageX = $derived(
    canvasWidth * 0.52 -
      imageWidth *
        ((portrait === 'miyabi' || portrait === 'crypto') && canvasWidth < 600
          ? 0.43
          : portrait === 'billy' || portrait === 'pwn'
            ? 0.54
            : 0.5)
  )
  const imageY = $derived(
    canvasHeight * 0.08 -
      imageHeight *
        (portrait === 'miyabi' || portrait === 'crypto'
          ? 0.26
          : portrait === 'nicole' || portrait === 'forensics'
            ? 0.11
            : portrait === 'billy' || portrait === 'pwn'
              ? 0.075
              : 0.14)
  )
  const instanceId = $props.id()
</script>

<div
  class="challenge-backdrop"
  data-art-id={id}
  style:color
  bind:clientWidth={width}
  bind:clientHeight={height}
  aria-hidden="true"
>
  <svg
    viewBox={`0 ${offset} ${canvasWidth} ${rowHeight}`}
    preserveAspectRatio="none"
    focusable="false"
  >
    <defs>
      <!-- Cyber Matrix Grid Pattern -->
      <pattern
        id={`${instanceId}-cyber-grid`}
        width="28"
        height="28"
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M 28 0 L 0 0 0 28"
          fill="none"
          stroke="currentColor"
          stroke-opacity="0.1"
          stroke-width="0.75"
        />
        <circle cx="0" cy="0" r="0.8" fill="currentColor" opacity="0.25" />
      </pattern>

      <!-- Glow filter -->
      <filter id={`${instanceId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <!-- Base Grid Layer -->
    <rect
      width={canvasWidth}
      height={canvasHeight}
      fill={`url(#${instanceId}-cyber-grid)`}
    />

    <!-- Pure Vector Graphical Motifs (PCB Tracks, Hexagonal Energy & Radar) -->
    <g class="hacker-graphics" stroke="currentColor" fill="none">
      <!-- Circuit Traces -->
      <path
        d={`M ${canvasWidth * 0.15} ${offset + rowHeight * 0.2} L ${canvasWidth * 0.35} ${offset + rowHeight * 0.2} L ${canvasWidth * 0.45} ${offset + rowHeight * 0.75} L ${canvasWidth * 0.85} ${offset + rowHeight * 0.75}`}
        stroke-width="1.2"
        opacity="0.3"
      />
      <circle cx={canvasWidth * 0.15} cy={offset + rowHeight * 0.2} r="2.5" fill="currentColor" opacity="0.6" />
      <circle cx={canvasWidth * 0.85} cy={offset + rowHeight * 0.75} r="2.5" fill="currentColor" opacity="0.6" />

      <!-- Concentric Radar / Sonar Arcs -->
      <circle
        cx={canvasWidth * 0.65}
        cy={offset + rowHeight * 0.5}
        r={rowHeight * 0.7}
        stroke-width="0.8"
        stroke-dasharray="4 4"
        opacity="0.2"
      />
      <circle
        cx={canvasWidth * 0.65}
        cy={offset + rowHeight * 0.5}
        r={rowHeight * 1.1}
        stroke-width="1"
        opacity="0.15"
      />

      <!-- Tactical Corner Targeting Reticle -->
      <path
        d={`M ${canvasWidth * 0.05} ${offset + 14} H ${canvasWidth * 0.05 + 16} M ${canvasWidth * 0.05} ${offset + 14} V ${offset + 30}`}
        stroke-width="1.5"
        stroke="var(--club-lime, #00ff66)"
        opacity="0.5"
      />
      <path
        d={`M ${canvasWidth * 0.95} ${offset + rowHeight - 14} H ${canvasWidth * 0.95 - 16} M ${canvasWidth * 0.95} ${offset + rowHeight - 14} V ${offset + rowHeight - 30}`}
        stroke-width="1.5"
        stroke="var(--club-lime, #00ff66)"
        opacity="0.5"
      />
    </g>

    <!-- Watermark Category Display Text -->
    <text
      x={canvasWidth * 0.045}
      y={offset + rowHeight * 0.52}
      font-family="var(--font-display)"
      font-weight="800"
      font-style="italic"
      font-size={Math.min(canvasWidth * 0.18, rowHeight * 0.65)}
      fill="currentColor"
      opacity="0.18"
    >{category.toUpperCase()}</text>

    <!-- PURE GRAPHICAL CTF ILLUSTRATION IMAGE (NO CODE) -->
    <image
      href={`/club/characters/${portrait}.png`}
      x={imageX}
      y={imageY}
      width={imageWidth}
      height={imageHeight}
    />
  </svg>
</div>

<style>
  .challenge-backdrop {
    position: absolute;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
    user-select: none;
    opacity: 0.42;
    filter: saturate(0.85);
    mask-image: linear-gradient(90deg, #0004, #000c 65%, #0005);
  }

  :global(:root[data-theme='light']) .challenge-backdrop {
    opacity: 0.28;
    filter: saturate(0.65) contrast(1.1);
  }
</style>
