<script lang="ts">
  import { onNavigate } from '$app/navigation'

  type TransitionState = 'idle' | 'closing' | 'covered' | 'opening'

  let state = $state<TransitionState>('idle')
  let resolveNavigation: (() => void) | null = null
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  function onCurtainClosed() {
    if (state === 'closing') {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      state = 'covered'
      resolveNavigation?.()
      resolveNavigation = null
    }
  }

  function onAnimationEnd(event: AnimationEvent) {
    const target = event.target
    if (!(target instanceof HTMLElement) || !target.classList.contains('curtain')) {
      return
    }

    if (state === 'closing') {
      onCurtainClosed()
    } else if (state === 'opening') {
      state = 'idle'
    }
  }

  onNavigate((navigation) => {
    if (!navigation.to?.url || navigation.to.url.href === navigation.from?.url.href) {
      return
    }

    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }

    state = 'closing'

    return new Promise<void>((resolve) => {
      resolveNavigation = resolve
      timeoutId = setTimeout(onCurtainClosed, 350)
    }).then(() => () => {
      requestAnimationFrame(() => {
        state = 'opening'
      })
    })
  })
</script>

<route-transition
  class:closing={state === 'closing'}
  class:covered={state === 'covered'}
  class:opening={state === 'opening'}
  onanimationend={onAnimationEnd}
  aria-hidden="true"
>
  <div class="accent"></div>
  <div class="curtain"></div>
  <div class="sigil">
    <div class="sigil-box">
      <div class="sigil-icon">
        <svg viewBox="0 0 24 24" class="sigil-svg">
          <polygon points="12,2 22,12 12,22 2,12" class="sigil-poly" />
          <polygon points="12,6 18,12 12,18 6,12" class="sigil-inner" />
        </svg>
      </div>
      <span class="sigil-text">INITIALIZING SECURE CHANNEL...</span>
    </div>
  </div>
</route-transition>

<style>
  route-transition {
    pointer-events: none;
    z-index: 99999;
    visibility: hidden;
    position: fixed;
    inset: 0;
    overflow: hidden;
  }

  route-transition.closing,
  route-transition.covered,
  route-transition.opening {
    visibility: visible;
    pointer-events: auto;
  }

  .curtain,
  .accent {
    will-change: translate;
    position: absolute;
    inset: -5%;
    translate: 105%;
  }

  .curtain {
    clip-path: polygon(8% 0, 100% 0, 100% 100%, 0 100%);
    background: radial-gradient(circle at 70% 45%, rgba(0, 255, 102, 0.12), transparent 45%), #080c0a;
    border-left: 2px solid rgba(0, 255, 102, 0.4);
    box-shadow: -20px 0 60px rgba(0, 0, 0, 0.8);
  }

  .accent {
    clip-path: polygon(10% 0, 100% 0, 100% 100%, 0 100%);
    background: linear-gradient(100deg, #008f37 0%, #00ff66 60%, #a8ffb2 100%);
    box-shadow: 0 0 50px rgba(0, 255, 102, 0.8);
  }

  :global(route-transition.closing) .accent {
    animation: 0.26s cubic-bezier(0.76, 0, 0.24, 1) both ucs-accent-close;
  }

  :global(route-transition.closing) .curtain {
    animation: 0.28s cubic-bezier(0.76, 0, 0.24, 1) 25ms both ucs-curtain-close;
  }

  :global(route-transition.covered) .accent,
  :global(route-transition.covered) .curtain {
    translate: 0;
  }

  :global(route-transition.opening) .accent {
    animation: 0.23s cubic-bezier(0.76, 0, 0.24, 1) 20ms both ucs-curtain-open;
  }

  :global(route-transition.opening) .curtain {
    animation: 0.25s cubic-bezier(0.76, 0, 0.24, 1) both ucs-curtain-open;
  }

  .sigil {
    opacity: 0;
    place-items: center;
    display: grid;
    position: absolute;
    inset: 0;
    transition: opacity 0.15s ease-out;
  }

  :global(route-transition.covered) .sigil {
    opacity: 1;
  }

  .sigil-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .sigil-icon {
    inline-size: 48px;
    block-size: 48px;
    animation: sigil-spin 2.4s linear infinite;
  }

  .sigil-svg {
    inline-size: 100%;
    block-size: 100%;
    filter: drop-shadow(0 0 12px rgba(0, 255, 102, 0.9));
  }

  .sigil-poly {
    fill: none;
    stroke: #00ff66;
    stroke-width: 1.5;
  }

  .sigil-inner {
    fill: rgba(0, 255, 102, 0.2);
    stroke: #00ff66;
    stroke-width: 1;
  }

  .sigil-text {
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.35em;
    color: #00ff66;
    text-shadow: 0 0 12px rgba(0, 255, 102, 0.8);
  }

  @keyframes sigil-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes ucs-accent-close {
    0% {
      translate: 105%;
    }
    to {
      translate: 0;
    }
  }

  @keyframes ucs-curtain-close {
    0% {
      translate: 105%;
    }
    to {
      translate: 0;
    }
  }

  @keyframes ucs-curtain-open {
    0% {
      translate: 0;
    }
    to {
      translate: -105%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(route-transition.closing) .accent,
    :global(route-transition.closing) .curtain,
    :global(route-transition.opening) .accent,
    :global(route-transition.opening) .curtain {
      animation: none;
    }
  }
</style>
