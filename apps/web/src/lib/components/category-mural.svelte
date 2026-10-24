<script lang="ts">
  type Props = { index: number; count: number; category: string }
  let { index, count, category }: Props = $props()

  const id = $props.id()
  const rows = $derived(Math.max(1, count))
  const height = $derived(rows * 100)
  const slice = $derived(Math.max(0, Math.min(index, rows - 1)) * 100)
  const moonY = $derived(Math.min(190, height * 0.23))
  const moonRadius = $derived(Math.min(137, height * 0.42))
  const towerTop = $derived(height * 0.15)
  const nearRoof = $derived(height * 0.49)
  const bridgeY = $derived(height * 0.77)
  const emblemY = $derived(height * 0.58)
  const emblemScale = $derived(Math.min(1, height / 540))
</script>

<!-- Every header is a window onto the same city, in category order. -->
<div class="category-mural" data-mural-category={category} aria-hidden="true">
  <svg
    viewBox={`0 ${slice} 1000 100`}
    preserveAspectRatio="none"
    focusable="false"
  >
    <defs>
      <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="var(--mural-sky-start, #222824)" />
        <stop offset="1" stop-color="var(--mural-sky-end, #353d32)" />
      </linearGradient>
      <linearGradient id={`${id}-moon`} x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="var(--mural-moon-start, #d6f344)" />
        <stop offset="1" stop-color="var(--mural-moon-end, #8c9c55)" />
      </linearGradient>
      <linearGradient id={`${id}-visibility`}>
        <stop offset="0" stop-color="white" stop-opacity="0" />
        <stop offset="0.24" stop-color="white" stop-opacity="0.04" />
        <stop offset="0.47" stop-color="white" stop-opacity="0.72" />
        <stop offset="0.72" stop-color="white" />
        <stop offset="1" stop-color="white" stop-opacity="0.8" />
      </linearGradient>
      <mask
        id={`${id}-mask`}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="1000"
        {height}
      >
        <rect width="1000" {height} fill={`url(#${id}-visibility)`} />
      </mask>
      <pattern
        id={`${id}-windows`}
        width="44"
        height="72"
        patternUnits="userSpaceOnUse"
      >
        <path d="M10 10H30V43H10Z" fill="#63715c" opacity="0.27" />
        <path d="M10 19H30M20 10V43" stroke="#252c27" stroke-width="3" />
        <path
          d="M11 48H30"
          stroke="#a0ad8d"
          stroke-opacity="0.3"
          stroke-width="2"
        />
      </pattern>
      <pattern
        id={`${id}-tower-windows`}
        width="82"
        height="100"
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M14 17H61V27H14ZM14 40H61V48H14Z"
          fill="#a1b284"
          opacity="0.36"
        />
        <path
          d="M14 64H61M14 73H61M14 82H61"
          stroke="#8d9c7d"
          stroke-opacity="0.35"
          stroke-width="3"
        />
        <path d="M38 17V48" stroke="#2c352c" stroke-width="5" />
      </pattern>
      <pattern
        id={`${id}-braces`}
        width="76"
        height="180"
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M0 0L76 90 0 180M76 0 0 90 76 180"
          fill="none"
          stroke="#829076"
          stroke-opacity="0.4"
          stroke-width="4"
        />
        <path
          d="M0 90H76"
          stroke="#a4b58d"
          stroke-opacity="0.3"
          stroke-width="5"
        />
      </pattern>
      <pattern
        id={`${id}-shutters`}
        width="100"
        height="14"
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M0 0H100"
          stroke="#839078"
          stroke-opacity="0.24"
          stroke-width="4"
        />
      </pattern>
    </defs>

    <g mask={`url(#${id}-mask)`}>
      <rect width="1000" {height} fill={`url(#${id}-sky)`} />

      <!-- A low orbital moon and its broken registration rings. -->
      <g transform={`translate(705 ${moonY})`}>
        <circle
          r={moonRadius + 22}
          fill="none"
          stroke="#89977c"
          stroke-opacity="0.35"
          stroke-width="2"
        />
        <circle
          r={moonRadius + 33}
          fill="none"
          stroke="#b6cb96"
          stroke-opacity="0.44"
          stroke-width="4"
          stroke-dasharray="92 24 3 18"
        />
        <circle r={moonRadius} fill={`url(#${id}-moon)`} opacity="0.63" />
        <path
          d={`M${-moonRadius * 0.88} ${moonRadius * 0.4}H${moonRadius * 0.88}M${-moonRadius * 0.7} ${moonRadius * 0.68}H${moonRadius * 0.7}`}
          stroke="#35452f"
          stroke-width="3"
          opacity="0.5"
        />
        <circle
          cx={moonRadius * 0.33}
          cy={-moonRadius * 0.28}
          r={moonRadius * 0.22}
          fill="#6e7e60"
          opacity="0.28"
        />
        <path
          d={`M${-moonRadius - 46} 0H${-moonRadius - 15}M0 ${-moonRadius - 45}V${-moonRadius - 16}`}
          stroke="#d1dfa9"
          stroke-width="3"
        />
      </g>

      <!-- The far district: stepped roofs, water tanks, and aerials. -->
      <path
        d={`M234 ${height}V${height * 0.47}H278V${height * 0.39}H322V${height * 0.47}H350V${height * 0.32}H393V${height * 0.26}H432V${height * 0.38}H482V${height * 0.29}H530V${height * 0.38}H573V${height}Z`}
        fill="#394435"
        stroke="#6a785f"
        stroke-width="2"
      />
      <path
        d={`M270 ${height * 0.49}V${height}M377 ${height * 0.36}V${height}M470 ${height * 0.4}V${height}`}
        stroke="#97a186"
        stroke-opacity="0.23"
        stroke-width="8"
      />
      <path
        d={`M411 ${height * 0.26}V${height * 0.17}M393 ${height * 0.21}H430M490 ${height * 0.29}V${height * 0.2}`}
        fill="none"
        stroke="#91a17d"
        stroke-width="3"
      />
      <path
        d={`M320 ${height * 0.52}H524V${height}H320Z`}
        fill={`url(#${id}-windows)`}
        opacity="0.6"
      />

      <!-- Rooftop receiver on the tallest slab of the district. -->
      <path
        d={`M843 ${height}V${towerTop + 65}L874 ${towerTop + 39}H975L1000 ${towerTop + 60}V${height}Z`}
        fill="#293129"
        stroke="#839076"
        stroke-width="2"
      />
      <path
        d={`M843 ${towerTop + 65}H1000M874 ${towerTop + 39}V${height}`}
        fill="none"
        stroke="#9dad87"
        stroke-opacity="0.46"
        stroke-width="3"
      />
      <path
        d={`M891 ${towerTop + 77}H973V${height}H891Z`}
        fill={`url(#${id}-tower-windows)`}
      />
      <path
        d={`M985 ${towerTop + 64}V${height}`}
        stroke="#b9d48b"
        stroke-opacity="0.46"
        stroke-width="6"
      />
      <g
        transform={`translate(928 ${towerTop + 38})`}
        fill="none"
        stroke="#a1ad91"
        stroke-width="3"
      >
        <path
          d="M0 0V-53M-20 0 0-36 20 0M-25-64Q0-35 26-64M-25-64 0-74 26-64M0-74V-90"
        />
        <path d="M-11-96H11M-5-105H5" stroke="#c6e58c" />
      </g>

      <!-- Exposed diagonal bracing and an illuminated service spine. -->
      <path
        d={`M745 ${height}V${height * 0.31}L783 ${height * 0.26} 821 ${height * 0.31}V${height}Z`}
        fill="#222b25"
        stroke="#69785e"
        stroke-width="3"
      />
      <rect
        x="745"
        y={height * 0.32}
        width="76"
        height={height * 0.68}
        fill={`url(#${id}-braces)`}
      />
      <path
        d={`M738 ${height * 0.34}V${height}M829 ${height * 0.34}V${height}`}
        stroke="#a6be80"
        stroke-opacity="0.52"
        stroke-width="4"
      />
      <path
        d={`M755 ${height * 0.31}H811M771 ${height * 0.275}H796`}
        stroke="#c5dba5"
        stroke-opacity="0.58"
        stroke-width="4"
      />

      <!-- Near building: projecting cornices and a rooftop cooling plant. -->
      <path
        d={`M440 ${height}V${nearRoof + 35}L480 ${nearRoof}H688L717 ${nearRoof + 35}V${height}Z`}
        fill="#283029"
        stroke="#7e8d71"
        stroke-width="3"
      />
      <path
        d={`M440 ${nearRoof + 35}H717L688 ${nearRoof}M480 ${nearRoof}V${nearRoof + 35}M697 ${nearRoof + 35}V${height}`}
        fill="none"
        stroke="#a5b18e"
        stroke-opacity="0.43"
        stroke-width="3"
      />
      <path
        d={`M469 ${nearRoof + 48}H677V${height}H469Z`}
        fill={`url(#${id}-windows)`}
      />
      <path
        d={`M501 ${nearRoof}V${nearRoof - 37}H559V${nearRoof}M506 ${nearRoof - 27}H554M506 ${nearRoof - 17}H554M579 ${nearRoof}V${nearRoof - 61}H639V${nearRoof}`}
        fill="#394436"
        stroke="#89987c"
        stroke-width="3"
      />
      <path
        d={`M581 ${nearRoof - 61}Q610 ${nearRoof - 82} 638 ${nearRoof - 61}M610 ${nearRoof - 72}V${nearRoof - 99}`}
        fill="none"
        stroke="#9ba78a"
        stroke-width="3"
      />
      <path
        d={`M454 ${nearRoof + 54}V${height}`}
        stroke="#afc88b"
        stroke-width="5"
        opacity="0.5"
      />

      <!-- An original fox-shaped receiver emblem on a hanging enamel sign. -->
      <g transform={`translate(648 ${emblemY}) scale(${emblemScale})`}>
        <path
          d="M-13-58V-88H41M13-58V-88"
          fill="none"
          stroke="#a4b48e"
          stroke-width="4"
        />
        <path
          d="M-51-54H39L53-40V57L39 71H-51Z"
          fill="#202a23"
          stroke="#9eb985"
          stroke-width="3"
        />
        <path
          d="M-43-47H33L45-35V51L33 63H-43Z"
          fill="none"
          stroke="#526b49"
          stroke-width="2"
        />
        <path
          d="M-31-31-8-14 11-15 33-34 27 15 2 40-24 17Z"
          fill="#aabc8d"
          opacity="0.8"
        />
        <path d="M-27-24-12-12-24-7M28-26 14-13 27-9" fill="#394a31" />
        <path
          d="M-23 1-5 6-17 14M26 0 8 6 20 14M-3 20H7L2 27Z"
          fill="#243127"
        />
        <path d="M-33 48H28" stroke="#bddb8e" stroke-width="3" />
        <circle cx="-34" cy="-37" r="2" fill="#d4dfc2" />
        <circle cx="35" cy="53" r="2" fill="#d4dfc2" />
      </g>

      <!-- Catenary wires connect the roofs and continue across slice seams. -->
      <g fill="none" stroke="#a8b494" stroke-opacity="0.54" stroke-width="2">
        <path
          d={`M298 ${height * 0.12}Q585 ${height * 0.43} 1006 ${height * 0.12}`}
        />
        <path
          d={`M270 ${height * 0.15}Q587 ${height * 0.48} 1006 ${height * 0.15}`}
        />
        <path
          d={`M380 ${height * 0.57}Q715 ${height * 0.76} 1040 ${height * 0.45}`}
        />
      </g>
      <path
        d={`M347 ${height * 0.14}V${height}M355 ${height * 0.14}V${height}`}
        stroke="#586b4e"
        stroke-width="4"
      />
      <path
        d={`M323 ${height * 0.19}H385M327 ${height * 0.19 - 9}V${height * 0.19 + 9}M376 ${height * 0.19 - 9}V${height * 0.19 + 9}`}
        stroke="#b5c49f"
        stroke-width="4"
      />

      <!-- The foreground elevated line winds through the lower district. -->
      <path
        d={`M305 ${height}L625 ${bridgeY + 10} 1000 ${bridgeY - 37}V${bridgeY + 4}L648 ${bridgeY + 53} 368 ${height}Z`}
        fill="#46553d"
        stroke="#a8ba90"
        stroke-width="3"
      />
      <path
        d={`M304 ${height - 12}L619 ${bridgeY - 10} 1000 ${bridgeY - 57}M311 ${height + 14}L634 ${bridgeY + 25} 1000 ${bridgeY - 23}`}
        fill="none"
        stroke="#ccdbb7"
        stroke-opacity="0.47"
        stroke-width="3"
      />
      <path
        d={`M675 ${bridgeY + 48}V${height}M692 ${bridgeY + 46}V${height}M907 ${bridgeY + 17}V${height}M924 ${bridgeY + 15}V${height}`}
        stroke="#526546"
        stroke-width="8"
      />
      <path
        d={`M765 ${bridgeY - 35}V${bridgeY - 101}Q765 ${bridgeY - 121} 786 ${bridgeY - 121}H818`}
        fill="none"
        stroke="#8ea277"
        stroke-width="4"
      />
      <path d={`M799 ${bridgeY - 121}H829`} stroke="#d2e7ab" stroke-width="7" />
      <path
        d={`M825 ${bridgeY + 64}H985V${height}H825Z`}
        fill="#222c25"
        stroke="#6e805e"
        stroke-width="3"
      />
      <path
        d={`M839 ${bridgeY + 79}H970V${height}H839Z`}
        fill={`url(#${id}-shutters)`}
      />

      <!-- Small rooftop aircraft, kept entirely graphical. -->
      <g transform={`translate(490 ${Math.min(110, height * 0.13)})`}>
        <path d="M-38 0-12-9H17L38 1 14 7H-17Z" fill="#93a77d" />
        <path
          d="M-49-8H-22M27-8H50M-35-8V0M38-8V1"
          stroke="#9da98f"
          stroke-width="3"
        />
        <path d="M-9-6H12L19 0H-13Z" fill="#2d3a2d" />
        <path d="M-12 12H8" stroke="#c7df9f" stroke-width="2" />
      </g>

      <!-- A quiet local light makes even a single isolated strip feel inhabited. -->
      <g transform={`translate(959 ${slice + 48})`}>
        <path
          d="M-8-10H8V10H-8Z"
          fill="#1f2b24"
          stroke="#9caf89"
          stroke-opacity="0.65"
          stroke-width="2"
        />
        <path
          d="M-3-4H3V4H-3Z"
          fill="var(--category-skin, #c4dc91)"
          opacity="0.8"
        />
      </g>
    </g>
  </svg>
</div>

<style>
  .category-mural {
    position: absolute;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
    user-select: none;
    opacity: 0.78;
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  :global(:root[data-theme='light']) .category-mural {
    --mural-sky-start: #e1e4d5;
    --mural-sky-end: #cbd2ba;
    --mural-moon-start: #8eab3c;
    --mural-moon-end: #647b32;
    opacity: 0.8;
  }

  :global(:root[data-theme='light']) svg :is(path, rect)[fill='#293129'],
  :global(:root[data-theme='light']) svg :is(path, rect)[fill='#222b25'],
  :global(:root[data-theme='light']) svg :is(path, rect)[fill='#283029'],
  :global(:root[data-theme='light']) svg :is(path, rect)[fill='#222c25'] {
    fill: #b9c4a7;
  }

  :global(:root[data-theme='light']) svg :is(path, rect)[fill='#394435'],
  :global(:root[data-theme='light']) svg :is(path, rect)[fill='#394436'] {
    fill: #c1c9b3;
  }

  :global(:root[data-theme='light']) svg :is(path, rect)[fill='#46553d'] {
    fill: #899c69;
  }
</style>
