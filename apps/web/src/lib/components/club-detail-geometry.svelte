<script lang="ts">
  const id = $props.id()
</script>

<svg
  class="detail-geometry"
  viewBox="0 0 900 620"
  preserveAspectRatio="xMidYMid slice"
  aria-hidden="true"
>
  <defs>
    <pattern
      id={`${id}-grid`}
      width="36"
      height="36"
      patternUnits="userSpaceOnUse"
    >
      <path
        d="M36 0H0V36"
        fill="none"
        stroke="currentColor"
        stroke-opacity=".08"
      />
    </pattern>
    <linearGradient id={`${id}-wash`} x1="0" x2="1">
      <stop stop-color="var(--detail-wash-start)" />
      <stop offset="1" stop-color="var(--detail-wash-end)" />
    </linearGradient>
  </defs>
  <path fill={`url(#${id}-wash)`} d="M0 0h900v620H0z" />
  <path fill={`url(#${id}-grid)`} d="M0 0h900v620H0z" />
  <g stroke="currentColor" fill="none" opacity=".16">
    <path
      d="M560-100 920 260 560 620M650-100 1010 260 650 620"
      stroke-width="42"
    />
    <circle cx="760" cy="260" r="190" />
    <circle cx="760" cy="260" r="220" />
    <path d="M520 260h480M760 20v480" />
  </g>
</svg>

<style>
  .detail-geometry {
    --detail-wash-start: light-dark(#f5f6e9, #1c1e20);
    --detail-wash-end: light-dark(#dce3be, #2b3021);
    position: absolute;
    inset: 0;
    z-index: -1;
    inline-size: 100%;
    block-size: 100%;
    color: light-dark(#475d25, #c5d38b);
    opacity: 0.65;
    pointer-events: none;
  }
</style>
