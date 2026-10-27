<script lang="ts">
  import { goto } from '$app/navigation'
  import CmatrixRain from '$lib/components/cmatrix-rain.svelte'
  import { useClientConfig } from '$lib/query/config'
  import { useCurrentUser } from '$lib/query/user'

  const configQuery = useClientConfig()
  const config = $derived(configQuery.data)
  const userQuery = useCurrentUser()
  const user = $derived(userQuery.data)

  interface MenuItem {
    label: string
    index: string
    href: string
  }

  const menuItems = $derived<MenuItem[]>([
    { label: 'Challenges', index: '01', href: '/challenges' },
    { label: 'Scoreboard', index: '02', href: '/scores' },
    { label: 'Info & Rules', index: '03', href: '/rules' },
    ...(user
      ? [{ label: 'My Account', index: '04', href: '/profile' }]
      : [
          ...(config?.registrationsEnabled !== false
            ? [{ label: 'Register', index: '04', href: '/register' }]
            : []),
          {
            label: 'Login',
            index: config?.registrationsEnabled !== false ? '05' : '04',
            href: '/login',
          },
        ]),
  ])

  let selectedIndex = $state(0)
  let activatingIndex = $state<number | null>(null)

  function move(step: number) {
    if (menuItems.length === 0) return
    selectedIndex = (selectedIndex + step + menuItems.length) % menuItems.length
  }

  function activate(index: number) {
    selectedIndex = index
    const target = menuItems[index]
    if (!target) return
    activatingIndex = index
    setTimeout(() => {
      void goto(target.href)
    }, 150)
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return
    }

    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault()
      move(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      activate(selectedIndex)
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
  <title>{config?.ctfName ?? 'UCS CTF'}</title>
</svelte:head>

<!-- Matrix rain background -->
<CmatrixRain opacity={0.25} speed={0.9} color="#00ff66" headColor="#e0ffe0" />

<nns-home class="ucs-home">
  <!-- Title & Event Details -->
  <header class="home-header">
    <div class="brand-tag">
      <span class="pulse-dot"></span>
      <span>USTH CYBERSECURITY CLUB</span>
    </div>
    <h1 class="home-title">{config?.ctfName ?? 'UCS CTF 2026'}</h1>
    <div class="home-date">
      HANOI, VIETNAM
    </div>
  </header>

  <!-- Interactive Terminal/Game Menu -->
  <nav aria-label="Main menu" class="home-nav">
    <div
      class="nav-cursor"
      style="--sel: {selectedIndex};"
      aria-hidden="true"
    >
      <svg class="cursor-arrow" viewBox="0 0 24 24">
        <polygon points="5,3 20,12 5,21" />
      </svg>
    </div>

    {#each menuItems as item, idx (item.label)}
      {@const isSelected = selectedIndex === idx}
      {@const isActivating = activatingIndex === idx}
      <button
        type="button"
        class="menu-item"
        class:is-activating={isActivating}
        data-selected={isSelected || undefined}
        onmouseenter={() => (selectedIndex = idx)}
        onfocus={() => (selectedIndex = idx)}
        onclick={() => activate(idx)}
      >
        <span class="menu-arrow" aria-hidden="true">
          <svg viewBox="0 0 16 16" class="item-arrow-svg">
            <polygon points="4,2 13,8 4,14" />
          </svg>
        </span>
        <span class="label">{item.label}</span>
        <span class="idx">{item.index}</span>
      </button>
    {/each}
  </nav>

  <!-- Bottom Left: Cyber diamond social buttons -->
  <div class="home-social">
    <a
      href="https://discord.gg/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Discord Community"
      class="social-ico"
    >
      <span class="ico-plate">
        <svg viewBox="0 0 24 18" aria-hidden="true">
          <path
            d="M20.3 1.5C18.8.8 17.2.4 15.5.2l-.7 1.4c-1.8-.3-3.7-.3-5.6 0L8.5.2C6.8.4 5.2.9 3.7 1.5 1.6 4.6.8 7.9 1 11.2c2 1.5 4 2.4 5.9 3l1-1.7c-.6-.2-1.2-.5-1.7-.9l.4-.3c3.4 1.6 7.2 1.6 10.6 0l.4.3c-.5.4-1.1.7-1.7.9l1 1.7c2-.6 3.9-1.5 5.9-3 .3-3.8-.7-7-2.5-9.7zM8.7 9.6c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.9.9 1.8 2c0 1.1-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.9.9 1.8 2c0 1.1-.8 2-1.8 2z"
          ></path>
        </svg>
      </span>
    </a>

    <a
      href="https://www.facebook.com/profile.php?id=61593161492676"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Facebook Page"
      class="social-ico"
    >
      <span class="ico-plate">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 2.04C6.5 2.04 2 6.53 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.85C10.44 7.34 11.93 5.96 14.22 5.96C15.31 5.96 16.45 6.15 16.45 6.15V8.62H15.19C13.95 8.62 13.56 9.39 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96A10 10 0 0 0 22 12.06C22 6.53 17.5 2.04 12 2.04Z"
          ></path>
        </svg>
      </span>
    </a>

    <a
      href="https://ctftime.org/team/436109"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="CTFtime Event"
      class="social-ico"
    >
      <span class="ico-plate">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 2c-.6 0-1 .4-1 1v18c0 .6.4 1 1 1s1-.4 1-1v-5h11.3c.5 0 .8-.6.4-1L16 11l3.1-4c.4-.4.1-1-.4-1H7V3c0-.6-.4-1-1-1z"
          ></path>
        </svg>
      </span>
    </a>
  </div>

  <!-- Bottom Right: Keyboard hints -->
  <div class="home-hints" aria-hidden="true">
    <span><kbd>↑↓</kbd> or <kbd>W S</kbd> Navigate</span>
    <span><kbd>⏎</kbd> Select</span>
  </div>

  <!-- Right Side: Enlarged Symmetrical UCS Logo Showcase -->
  <aside class="home-brand-hero" aria-label="UCS Logo">
    <div class="hero-logo-card">
      <img
        src="/images/ucs-banner.png"
        alt="USTH CyberSecurity Club"
        class="hero-logo-img"
      />
    </div>
  </aside>
</nns-home>

<style>
  .ucs-home {
    --ucs-green: #00ff66;
    --ucs-green-hover: #1aff75;
    --ucs-ink: #080c0a;
    --ucs-text: #e9eeeb;
    --ucs-muted: #8aa193;

    font-family: var(--font-sans);
    color: var(--ucs-text);
    display: contents;
  }

  .home-header {
    user-select: none;
    position: fixed;
    inset-block-start: 12vh;
    inset-inline-start: 6vw;
    z-index: 10;
  }

  .brand-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    letter-spacing: 0.16em;
    color: var(--ucs-green);
    text-transform: uppercase;
    margin-block-end: 0.5rem;
    font-weight: 600;
  }

  .pulse-dot {
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    background: var(--ucs-green);
    box-shadow: 0 0 10px var(--ucs-green);
    animation: pulse 1.8s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.4; transform: scale(0.9); }
    50% { opacity: 1; transform: scale(1.2); }
  }

  .home-title {
    color: #ffffff;
    font-size: clamp(2rem, 3.8vw, 3.25rem);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.01em;
    text-shadow: 0 0 24px rgba(0, 255, 102, 0.25);
  }

  .home-date {
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--ucs-green);
    opacity: 0.9;
    margin-block-start: 0.75rem;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .home-nav {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    inline-size: min(340px, 80vw);
    position: fixed;
    inset-block-start: 46vh;
    inset-inline-start: 6vw;
    z-index: 10;
  }

  @media (width <= 720px) {
    .home-header {
      inset-block-start: 9vh;
      inset-inline-start: 5vw;
    }
    .home-nav {
      inline-size: 90vw;
      inset-block-start: 40vh;
      inset-inline-start: 5vw;
    }
  }

  /* Animated glowing blinking triangular arrow cursor */
  .nav-cursor {
    pointer-events: none;
    z-index: 4;
    block-size: 1.4rem;
    inline-size: 1.4rem;
    transition: top 0.22s cubic-bezier(0.6, 0.2, 0.2, 1.4);
    position: absolute;
    inset-block-start: calc(var(--sel, 0) * 64px + 14px);
    inset-inline-start: -26px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nav-cursor .cursor-arrow {
    inline-size: 100%;
    block-size: 100%;
    fill: #00ff66;
    filter: drop-shadow(0 0 8px rgba(0, 255, 102, 0.95)) drop-shadow(0 0 16px rgba(0, 255, 102, 0.6));
    animation: arrow-tick-tock 0.8s infinite;
  }

  @keyframes arrow-tick-tock {
    0%, 49.9% {
      opacity: 1;
      visibility: visible;
    }
    50%, 100% {
      opacity: 0;
      visibility: hidden;
    }
  }

  @media (width <= 720px) {
    .nav-cursor {
      display: none;
    }
  }

  /* Cyber angular polygon menu item */
  .menu-item {
    text-align: start;
    block-size: 52px;
    font-family: var(--font-sans);
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--ucs-text);
    cursor: pointer;
    clip-path: polygon(0% 0%, 93% 0%, 100% 50%, 93% 100%, 0% 100%, 4% 50%);
    background: linear-gradient(100deg, rgba(8, 12, 10, 0.92), rgba(13, 20, 16, 0.8) 80%);
    border: 1px solid rgba(0, 255, 102, 0.15);
    outline: none;
    align-items: center;
    gap: 0.75rem;
    padding-inline: 30px 24px;
    font-size: 1rem;
    font-weight: 700;
    transition: translate 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                background 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    position: relative;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  .menu-item[data-selected] {
    color: var(--ucs-ink);
    background: linear-gradient(100deg, #00ff66 0%, #1aff75 55%, #a8ffb2 100%);
    translate: 1rem;
    border-color: #00ff66;
    box-shadow: 0 0 24px rgba(0, 255, 102, 0.5), inset 0 0 8px rgba(255, 255, 255, 0.4);
  }

  .menu-item .menu-arrow {
    flex: none;
    block-size: 14px;
    inline-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .menu-item .item-arrow-svg {
    inline-size: 100%;
    block-size: 100%;
    fill: rgba(0, 255, 102, 0.45);
    transition: fill 0.2s;
  }

  .menu-item[data-selected] .menu-arrow {
    transform: translateX(2px);
  }

  .menu-item[data-selected] .item-arrow-svg {
    fill: var(--ucs-ink);
  }

  .menu-item .label {
    white-space: nowrap;
    text-overflow: ellipsis;
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
  }

  .menu-item .idx {
    letter-spacing: 0.12em;
    color: rgba(0, 255, 102, 0.6);
    flex: none;
    margin-inline-start: auto;
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .menu-item[data-selected] .idx {
    color: rgba(8, 12, 10, 0.7);
    font-weight: 800;
  }

  .menu-item.is-activating {
    animation: 0.28s stamp;
  }

  @keyframes stamp {
    40% { transform: translate(16px) scale(0.96); }
    to { transform: translate(16px) scale(1); }
  }

  /* Social diamond buttons */
  .home-social {
    align-items: center;
    gap: 1.25rem;
    display: flex;
    position: fixed;
    inset-block-end: 4vh;
    inset-inline-start: 6vw;
    z-index: 10;
  }

  .social-ico {
    text-decoration: none;
    display: inline-block;
  }

  .ico-plate {
    clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
    background: linear-gradient(140deg, rgba(8, 12, 10, 0.95), rgba(13, 20, 16, 0.85));
    border: 1px solid rgba(0, 255, 102, 0.2);
    place-items: center;
    block-size: 3.5rem;
    inline-size: 3.5rem;
    transition: background 0.2s ease-out, rotate 0.2s ease-out, scale 0.2s ease-out, translate 0.2s ease-out, box-shadow 0.2s ease-out;
    display: grid;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .social-ico:hover .ico-plate,
  .social-ico:focus-visible .ico-plate {
    background: linear-gradient(140deg, #00ff66, #1aff75);
    translate: 0.25rem;
    rotate: 45deg;
    scale: 1.08;
    box-shadow: 0 0 16px rgba(0, 255, 102, 0.6);
  }

  .ico-plate svg {
    block-size: 22px;
    inline-size: 22px;
    fill: var(--ucs-green);
    transition: rotate 0.2s, fill 0.2s;
  }

  .social-ico:hover .ico-plate svg,
  .social-ico:focus-visible .ico-plate svg {
    fill: var(--ucs-ink);
    rotate: -45deg;
  }

  /* Keyboard hints */
  .home-hints {
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--ucs-muted);
    gap: 20px;
    font-size: 0.8125rem;
    font-weight: 500;
    display: flex;
    position: fixed;
    inset-block-end: 4vh;
    inset-inline-end: 6vw;
    z-index: 10;
  }

  .home-hints span {
    align-items: center;
    display: flex;
  }

  .home-hints kbd {
    font-family: var(--font-mono, monospace);
    color: var(--ucs-ink);
    clip-path: polygon(12% 0%, 100% 0%, 88% 100%, 0% 100%);
    background: linear-gradient(#00ff66, #1aff75);
    margin-inline-end: 0.5rem;
    padding: 2px 7px;
    font-weight: 700;
    font-size: 0.75rem;
  }

  @media (width <= 720px) {
    .home-hints {
      display: none;
    }
  }

  /* Right Side: Enlarged Symmetrical UCS Logo Showcase */
  .home-brand-hero {
    position: fixed;
    inset-block-start: 46vh;
    inset-inline-end: 7vw;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 5;
    pointer-events: none;
  }

  .hero-logo-card {
    position: relative;
    padding: 1.25rem 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: radial-gradient(circle at center, rgba(0, 255, 102, 0.05) 0%, transparent 70%);
  }

  .hero-logo-img {
    display: block;
    inline-size: min(480px, 42vw);
    block-size: auto;
    object-fit: contain;
    filter: drop-shadow(0 0 20px rgba(0, 255, 102, 0.4)) drop-shadow(0 0 45px rgba(0, 255, 102, 0.15));
    animation: hero-logo-float 4.5s ease-in-out infinite alternate;
  }

  @keyframes hero-logo-float {
    0% {
      transform: translateY(0);
      filter: drop-shadow(0 0 16px rgba(0, 255, 102, 0.3));
    }
    100% {
      transform: translateY(-6px);
      filter: drop-shadow(0 0 30px rgba(0, 255, 102, 0.55)) drop-shadow(0 0 60px rgba(0, 255, 102, 0.2));
    }
  }

  @media (width <= 900px) {
    .home-brand-hero {
      display: none;
    }
  }
</style>
