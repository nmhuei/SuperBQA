<script lang="ts">
  import { page } from '$app/state'
  import { useClientConfig } from '$lib/query/config'
  import { intervalToDuration } from '$lib/utils/time'

  const configQuery = useClientConfig()
  const clientConfig = $derived(configQuery.data)

  const startTime = $derived(clientConfig?.startTime ?? 0)
  const endTime = $derived(clientConfig?.endTime ?? 0)

  let now = $state(Date.now())
  const hasStarted = $derived(now >= startTime)
  const hasEnded = $derived(now >= endTime)

  $effect(() => {
    if (hasEnded) return
    const interval = setInterval(() => (now = Date.now()), 1000)
    return () => clearInterval(interval)
  })

  const label = $derived(
    clientConfig?.isArchived
      ? 'Archived'
      : hasEnded
        ? 'Event ended'
        : hasStarted
          ? 'remaining'
          : 'until start'
  )

  const text = $derived.by(() => {
    if (hasEnded) return '--:--:--'
    const targetTime = hasStarted ? endTime : startTime
    const { days, hours, minutes, seconds } = intervalToDuration(
      Math.max(0, targetTime - now)
    )
    const pad = (value: number) => String(value).padStart(2, '0')
    const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    return days > 0 ? `${days}d ${clock}` : clock
  })
</script>

{#if clientConfig?.clubMode === 'event' && ['/challenges', '/scores'].includes(page.url.pathname) && (startTime > 0 || endTime > 0)}
  <nav-countdown>
    {#if !hasEnded}<countdown-time>{text}</countdown-time>{/if}
    <countdown-label>{label}</countdown-label>
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
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  countdown-label {
    display: block;
    font-size: 0.625rem;
    color: var(--foreground-l3);
  }
</style>
