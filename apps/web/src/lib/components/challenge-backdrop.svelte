<script lang="ts">
  import { getChallengeArt } from '$lib/club/challenge-art'

  type Props = { id: string; category: string; index?: number; count?: number }
  let { id, category, index = 0, count = 1 }: Props = $props()
  let width = $state(0)
  let height = $state(0)
  const key = $derived(category.trim().toLowerCase())
  const portraits = new Map([
    ['web', 'anby'],
    ['crypto', 'miyabi'],
    ['cryptography', 'miyabi'],
    ['forensics', 'nicole'],
    ['pwn', 'billy'],
    ['binary', 'billy'],
    ['reverse', 'ellen'],
    ['rev', 'ellen'],
    ['misc', 'lycaon'],
    ['blockchain', 'miyabi'],
    ['osint', 'nicole'],
    ['koth', 'billy'],
    ['ad', 'ellen'],
    ['sanity', 'anby'],
    ['ppc', 'lycaon'],
  ])
  const portrait = $derived(portraits.get(key) ?? 'lycaon')
  const color = $derived(getChallengeArt(id, category).color)
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
        (portrait === 'miyabi' && canvasWidth < 600
          ? 0.43
          : portrait === 'billy'
            ? 0.54
            : 0.5)
  )
  const imageY = $derived(
    canvasHeight * 0.08 -
      imageHeight *
        (portrait === 'miyabi'
          ? 0.26
          : portrait === 'nicole'
            ? 0.11
            : portrait === 'billy'
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
      <pattern
        id={`${instanceId}-grid`}
        width="36"
        height="36"
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M36 0H0V36"
          fill="none"
          stroke="currentColor"
          stroke-opacity="0.12"
          stroke-width="0.7"
        />
      </pattern>
    </defs>
    <rect
      width={canvasWidth}
      height={canvasHeight}
      fill={`url(#${instanceId}-grid)`}
    />
    <g stroke="currentColor" fill="none" opacity="0.18">
      <circle
        cx={canvasWidth * 0.63}
        cy={canvasHeight * 0.57}
        r={canvasHeight * 0.69}
      />
      <circle
        cx={canvasWidth * 0.63}
        cy={canvasHeight * 0.57}
        r={canvasHeight * 0.76}
      />
      <path
        d={`M${canvasWidth * 0.03} ${canvasHeight * 0.85} ${canvasWidth * 0.4} ${canvasHeight * 0.07}H${canvasWidth * 0.9}`}
      />
    </g>
    <text
      x={canvasWidth * 0.045}
      y={canvasHeight * 0.45}
      font-family="var(--font-display)"
      font-weight="800"
      font-style="italic"
      font-size={Math.min(canvasWidth * 0.23, canvasHeight * 0.45)}
      fill="currentColor"
      opacity="0.2">{category.toUpperCase()}</text
    >
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
    opacity: 0.32;
    filter: saturate(0.45);
    mask-image: linear-gradient(90deg, #0004, #000c 65%, #0005);
  }
  :global(:root[data-theme='light']) .challenge-backdrop {
    opacity: 0.4;
    filter: saturate(0.8);
  }
  svg {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }
</style>
