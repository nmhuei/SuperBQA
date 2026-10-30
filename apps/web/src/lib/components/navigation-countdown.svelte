<script lang="ts">
  import { page } from '$app/state'
  import { prioritizeClubEvents } from '$lib/club/club-event-model'
  import { useClubEvents } from '$lib/query/club-events'
  import { intervalToDuration } from '$lib/utils/time'

  const eventsQuery = useClubEvents(() => true)
  const events = $derived(eventsQuery.data ?? [])

  let now = $state(Date.now())

  const openEvent = $derived.by(() => {
    // 1. If on /scores or /scores/*:
    if (page.url.pathname === '/scores' || page.url.pathname.startsWith('/scores/')) {
      const eventParam = page.url.searchParams.get('event')
      if (eventParam) {
        const found = events.find(e => e.id === eventParam)
        if (found) return found
      }
      const prioritized = prioritizeClubEvents(events, now)
      return prioritized[0] ?? null
    }

    // 2. If viewing a specific event via query param (e.g. /challenges?event=[id]):
    const eventParam = page.url.searchParams.get('event')
    if (eventParam) {
      const found = events.find(e => e.id === eventParam)
      if (found) return found
    }

    // 3. If viewing a specific event path /club/events/[id]:
    const match = page.url.pathname.match(/^\/club\/events\/([^/]+)/)
    if (match?.[1]) {
      const id = decodeURIComponent(match[1])
      const found = events.find(e => e.id === id)
      if (found) return found
    }

    // Otherwise (e.g. /club/events catalog, /, /rules, /profile, /admin):
    // No event is open, remove timer ("bỏ bộ đếm giờ đi")
    return null
  })

  const startTime = $derived(openEvent?.startTime ?? 0)
  const endTime = $derived(openEvent?.endTime ?? 0)

  const hasStarted = $derived(openEvent ? now >= startTime : false)
  const hasEnded = $derived(openEvent ? now >= endTime : false)

  $effect(() => {
    if (!openEvent || hasEnded) return
    const interval = setInterval(() => (now = Date.now()), 1000)
    return () => clearInterval(interval)
  })

  const label = $derived(
    hasEnded
      ? 'Event ended'
      : hasStarted
        ? 'remaining'
        : 'until start'
  )

  const text = $derived.by(() => {
    if (!openEvent || hasEnded) return '--:--:--'
    const targetTime = hasStarted ? endTime : startTime
    const diff = Math.max(0, targetTime - now)
    const { days, hours, minutes, seconds } = intervalToDuration(diff)
    const pad = (value: number) => String(value).padStart(2, '0')
    const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    return days > 0 ? `${days}d ${clock}` : clock
  })
</script>

{#if openEvent}
  <nav-countdown>
    {#if !hasEnded}
      <countdown-time class:is-live={hasStarted}>{text}</countdown-time>
    {/if}
    <countdown-label class:is-ended={hasEnded} class:is-live={hasStarted && !hasEnded}>
      {label}
    </countdown-label>
  </nav-countdown>
{/if}

<style>
  nav-countdown {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    block-size: 3rem;
    min-inline-size: 7.5rem;
    border: 1px solid transparent;
    padding-inline: var(--space-s);
    background: transparent;
    border-radius: var(--radius-lg);

    @media (width < 80rem) {
      display: none;
    }
  }

  countdown-time {
    display: block;
    color: var(--foreground-l1);
    font-family: var(--font-mono);
    font-size: 0.875rem;
    font-weight: 700;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  countdown-time.is-live {
    color: var(--club-lime, #00f076);
    text-shadow: 0 0 8px rgba(0, 240, 118, 0.4);
  }

  countdown-label {
    display: block;
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--foreground-l3);
  }

  countdown-label.is-live {
    color: var(--club-lime, #00f076);
  }

  countdown-label.is-ended {
    color: var(--foreground-l3);
  }
</style>
