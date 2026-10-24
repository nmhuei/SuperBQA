<script lang="ts">
  import {
    solveCelebrationContext,
    type SolveCelebration,
    type SolveCelebrations,
  } from '$lib/club/celebration'
  import { useCurrentUser } from '$lib/query/user'
  import Portal from '$lib/ui/portal.svelte'
  import { getContext, onMount } from 'svelte'

  const celebrations = getContext<SolveCelebrations>(solveCelebrationContext)
  const user = useCurrentUser()
  let active = $state<SolveCelebration | null>(null)
  let announcement = $state('')
  let sequence = $state(0)
  let finishTimer: ReturnType<typeof setTimeout> | undefined
  let announcementTimer: ReturnType<typeof setTimeout> | undefined

  const particles = Array.from({ length: 14 }, (_, i) => {
    const angle = (((i * 360) / 14 - 12) * Math.PI) / 180
    return {
      x: `${(Math.cos(angle) * (34 + (i % 3) * 4)).toFixed(2)}vw`,
      y: `${(Math.sin(angle) * (25 + (i % 4) * 3)).toFixed(2)}vh`,
      turn: `${i % 2 ? -130 - i * 13 : 150 + i * 17}deg`,
      delay: `${130 + i * 12}ms`,
    }
  })

  $effect(() => celebrations.setUser(user.data?.id ?? null))

  function dismiss() {
    clearTimeout(finishTimer)
    clearTimeout(announcementTimer)
    active = null
    announcement = ''
  }

  onMount(() => {
    const unsubscribe = celebrations.subscribe(event => {
      dismiss()
      if (!event) return
      active = event
      sequence += 1
      announcementTimer = setTimeout(() => {
        announcement = `Mission complete. ${event.title}. ${event.result}.`
      }, 40)
      finishTimer = setTimeout(
        dismiss,
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 2000
          : 2200
      )
    })
    return () => {
      unsubscribe()
      dismiss()
    }
  })
</script>

<svelte:document
  onkeydown={event => {
    if (event.key === 'Escape') dismiss()
  }}
/>

<div
  class="celebration-live"
  role="status"
  aria-live="polite"
  aria-atomic="true"
  {@attach node => {
    // Modal content hides external live regions. Keep this announcement inside
    // the open drawer without making the visual overlay a focus destination.
    void active
    const dialogs = document.querySelectorAll(
      'dialog[open], [role="dialog"][data-state="open"]'
    )
    const host = dialogs.item(dialogs.length - 1) ?? document.body
    host.appendChild(node)
    return () => node.remove()
  }}
>
  {announcement}
</div>

{#if active}
  {#key sequence}
    <Portal>
      <div
        class="ucs-celebration"
        aria-hidden="true"
        {@attach node => {
          // A manual popover joins the top layer without taking focus or
          // trapping input. The fixed-position fallback remains noninteractive.
          if (typeof node.showPopover !== 'function') return
          // Moving a popover's ancestor closes it. Wait for Portal's attachment
          // to move its root to the body before opening the top layer.
          queueMicrotask(() => {
            if (!node.isConnected) return
            node.setAttribute('popover', 'manual')
            try {
              node.showPopover()
            } catch {
              node.removeAttribute('popover')
            }
          })
        }}
      >
        <div class="ucs-celebration__particles">
          {#each particles as particle, i (i)}
            <i
              class="ucs-celebration__particle"
              style:--flight-x={particle.x}
              style:--flight-y={particle.y}
              style:--turn={particle.turn}
              style:--delay={particle.delay}
            ></i>
          {/each}
        </div>
        <div class="ucs-celebration__ribbon">
          <div class="ucs-celebration__content">
            <span class="ucs-celebration__emblem">✓</span>
            <div class="ucs-celebration__copy">
              <div class="ucs-celebration__kicker">
                <span
                  >{active.practice
                    ? 'Archive practice'
                    : 'Flag accepted'}</span
                >
                <span class="ucs-celebration__signature">UCS / 01</span>
              </div>
              <h2 class="ucs-celebration__heading">MISSION COMPLETE</h2>
              <div class="ucs-celebration__detail">
                <span class="ucs-celebration__challenge">{active.title}</span>
                <span class="ucs-celebration__result">{active.result}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  {/key}
{/if}

<style>
  .celebration-live {
    position: fixed;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }

  .ucs-celebration {
    position: fixed;
    inset: 0;
    z-index: 2147483646;
    display: block;
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    overflow: hidden;
    isolation: isolate;
    pointer-events: none;
    background: transparent;
    color: #141619;
    font-family: var(--font-sans);
  }

  .ucs-celebration::backdrop {
    background: transparent;
    pointer-events: none;
  }

  .ucs-celebration *,
  .ucs-celebration *::before,
  .ucs-celebration *::after {
    box-sizing: border-box;
    pointer-events: none;
  }

  .ucs-celebration__ribbon {
    position: absolute;
    top: 50%;
    left: 50%;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    place-items: center;
    width: 145vw;
    min-height: 184px;
    padding: 21px 0 24px;
    border-top: 3px solid #141619;
    border-bottom: 3px solid #141619;
    background: var(--club-lime);
    box-shadow:
      0 10px 0 #141619,
      0 -7px 0 #eef1ed;
    transform: translate3d(-50%, -50%, 0) rotate(-8deg);
    animation: ucs-mission-ribbon 2200ms both;
    will-change: transform, opacity;
  }

  .ucs-celebration__ribbon::before,
  .ucs-celebration__ribbon::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 17vw;
    opacity: 0.15;
    background: repeating-linear-gradient(
      90deg,
      #141619 0 3px,
      transparent 3px 12px
    );
  }

  .ucs-celebration__ribbon::before {
    left: 7vw;
  }
  .ucs-celebration__ribbon::after {
    right: 7vw;
  }

  .ucs-celebration__content {
    display: flex;
    align-items: center;
    gap: 24px;
    min-width: 0;
    width: min(940px, calc(100vw - 64px));
    margin: 0;
  }

  .ucs-celebration__emblem {
    display: grid;
    flex: none;
    place-items: center;
    width: 78px;
    height: 78px;
    border: 2px solid currentColor;
    color: #141619;
    font-size: 45px;
    font-weight: 600;
    transform: rotate(-5deg);
    box-shadow: 5px 5px 0 #141619;
  }

  .ucs-celebration__copy {
    min-width: 0;
    flex: 1;
  }

  .ucs-celebration__kicker {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin: 0 0 5px;
    font-size: 10px;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .ucs-celebration__signature {
    opacity: 0.65;
  }

  .ucs-celebration__heading {
    margin: 0;
    padding: 0;
    font-family: var(--font-display);
    font-size: clamp(42px, 6.1vw, 87px);
    font-style: italic;
    font-weight: 800;
    line-height: 0.98;
    letter-spacing: 0.2px;
    white-space: nowrap;
    color: #141619;
  }

  .ucs-celebration__detail {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 10px;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
  }

  .ucs-celebration__challenge {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ucs-celebration__result {
    flex: none;
    padding-left: 16px;
    border-left: 1px solid #14161966;
    white-space: nowrap;
  }

  .ucs-celebration__particles {
    position: absolute;
    inset: 0;
  }

  .ucs-celebration__particle {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 10px;
    height: 17px;
    background: var(--club-lime);
    clip-path: polygon(25% 0, 100% 10%, 75% 100%, 0 80%);
    opacity: 0;
    animation: ucs-mission-particle 1800ms var(--delay)
      cubic-bezier(0.1, 0.65, 0.25, 1) both;
    will-change: transform, opacity;
  }

  .ucs-celebration__particle:nth-child(3n) {
    width: 14px;
    height: 14px;
    background: #eef1ed;
    clip-path: polygon(50% 0, 100% 100%, 0 85%);
  }

  .ucs-celebration__particle:nth-child(3n + 1) {
    width: 7px;
    height: 19px;
    background: #9ebd78;
  }

  @keyframes ucs-mission-ribbon {
    0% {
      opacity: 0;
      transform: translate3d(calc(-50% - 110vw), calc(-50% + 16vw), 0)
        rotate(-8deg);
      animation-timing-function: cubic-bezier(0.12, 0.8, 0.22, 1);
    }
    8% {
      opacity: 1;
    }
    22%,
    68% {
      opacity: 1;
      transform: translate3d(-50%, -50%, 0) rotate(-8deg);
      animation-timing-function: cubic-bezier(0.75, 0, 0.85, 0.35);
    }
    100% {
      opacity: 0;
      transform: translate3d(calc(-50% + 110vw), calc(-50% - 16vw), 0)
        rotate(-8deg);
    }
  }

  @keyframes ucs-mission-particle {
    0% {
      opacity: 0;
      transform: translate3d(0, 0, 0) rotate(0);
    }
    13% {
      opacity: 0.95;
    }
    64% {
      opacity: 0.9;
    }
    100% {
      opacity: 0;
      transform: translate3d(var(--flight-x), var(--flight-y), 0)
        rotate(var(--turn));
    }
  }

  @media (max-width: 600px) {
    .ucs-celebration__ribbon {
      min-height: 142px;
      padding: 20px 0;
    }
    .ucs-celebration__content {
      width: calc(100vw - 48px);
      gap: 12px;
    }
    .ucs-celebration__emblem {
      display: none;
    }
    .ucs-celebration__heading {
      font-size: clamp(35px, 11.2vw, 64px);
    }
    .ucs-celebration__kicker {
      font-size: 8px;
      letter-spacing: 1.3px;
      margin-bottom: 7px;
    }
    .ucs-celebration__detail {
      gap: 10px;
      font-size: 11px;
      margin-top: 9px;
    }
    .ucs-celebration__result {
      padding-left: 10px;
    }
    .ucs-celebration__particle {
      width: 7px;
      height: 12px;
    }
  }

  /* A preference change also stops motion in a celebration already on screen. */
  @media (prefers-reduced-motion: reduce) {
    .ucs-celebration__ribbon {
      top: auto;
      bottom: max(24px, env(safe-area-inset-bottom));
      width: min(460px, calc(100vw - 28px));
      min-height: 0;
      padding: 18px 20px;
      border: 1px solid #141619;
      border-radius: 7px;
      box-shadow: 0 4px 0 #141619;
      transform: translateX(-50%);
      animation: none;
      will-change: auto;
    }
    .ucs-celebration__content {
      width: 100%;
      gap: 14px;
    }
    .ucs-celebration__heading {
      font-size: 32px;
    }
    .ucs-celebration__detail {
      font-size: 11px;
      margin-top: 8px;
      gap: 10px;
    }
    .ucs-celebration__result {
      padding-left: 10px;
    }
    .ucs-celebration__kicker {
      font-size: 8px;
      letter-spacing: 1.3px;
    }
    .ucs-celebration__emblem,
    .ucs-celebration__ribbon::before,
    .ucs-celebration__ribbon::after,
    .ucs-celebration__particles {
      display: none;
    }
  }
</style>
