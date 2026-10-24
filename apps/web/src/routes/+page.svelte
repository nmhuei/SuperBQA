<script lang="ts">
  import { getEventCountdown, getEventPhase } from '$lib/club/dashboard'
  import { archiveChallengeHref } from '$lib/club/archive-model'
  import ClubDetailGeometry from '$lib/components/club-detail-geometry.svelte'
  import { useClubAccess, useClubArchives } from '$lib/query/club'
  import { useClientConfig } from '$lib/query/config'
  import Button from '$lib/ui/button.svelte'

  const configQuery = useClientConfig()
  const config = $derived(configQuery.data)
  const access = useClubAccess()
  const clubMode = $derived(config?.clubMode === 'club')
  const canPractice = $derived(
    access.data?.canAccessArchives === true && !access.isError
  )
  const archives = useClubArchives(() => clubMode && canPractice)
  const latestArchive = $derived(
    canPractice && !archives.isError
      ? archives.data?.toSorted((a, b) => b.endTime - a.endTime)[0]
      : undefined
  )
  let now = $state(Date.now())
  const phase = $derived(config ? getEventPhase(config, now) : 'idle')
  const closed = $derived(clubMode || phase === 'ended' || phase === 'archived')
  const practiceHome = $derived(clubMode && canPractice)
  const countdown = $derived(config ? getEventCountdown(config, now) : '')
  const date = (time: number) =>
    new Date(time).toLocaleDateString('en', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
  const dateTime = (time: number) =>
    new Date(time).toLocaleString('en', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      hour12: false,
    })
  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 1000)
    return () => clearInterval(timer)
  })
</script>

<svelte:head
  ><title>{practiceHome ? 'Home' : 'Event'} | {config?.ctfName ?? 'UCS'}</title
  ></svelte:head
>

<section class="club-home" aria-labelledby="home-title">
  <h1 id="home-title" data-visually-hidden>
    {practiceHome ? 'Club home' : (config?.ctfName ?? 'UCS')}
  </h1>
  <section
    class="home-feature"
    aria-label={practiceHome ? 'Practice' : 'Event details'}
  >
    <ClubDetailGeometry />
    <div class="feature-content">
      {#if clubMode && access.isPending}
        <h2>Home</h2>
        <p role="status">Checking club access…</p>
      {:else if clubMode && access.isError}
        <h2>Home</h2>
        <p role="alert">Unable to check club access.</p>
        <Button variant="outline" onclick={() => access.refetch()}>Retry</Button
        >
      {:else if practiceHome}
        <span class="eyebrow">Practice archive</span>
        <h2>{latestArchive?.name ?? 'Practice'}</h2>
        {#if access.isError}
          <p role="alert">Unable to check archive access.</p>
          <Button variant="outline" onclick={() => access.refetch()}
            >Retry</Button
          >
        {:else if canPractice && archives.isError}
          <p role="alert">Unable to load the practice archive.</p>
          <Button variant="outline" onclick={() => archives.refetch()}
            >Retry</Button
          >
        {:else if access.isPending || (canPractice && archives.isPending)}
          <p role="status">Loading archive…</p>
        {:else if canPractice && !latestArchive}
          <p>No archived events yet.</p>
        {/if}
        <div class="home-actions">
          <Button href="/club/events" variant="outline">Club events</Button>
          {#if canPractice && latestArchive}
            <Button href={archiveChallengeHref(latestArchive.id)}
              >Continue practice <span aria-hidden="true">↗</span></Button
            >
            <Button href="/archive" variant="outline">Browse archive</Button>
          {:else}
            <Button href="/archive"
              >Browse archive <span aria-hidden="true">↗</span></Button
            >
          {/if}
        </div>
      {:else}
        {#if config && phase !== 'idle'}
          <span class="eyebrow"
            >{phase === 'upcoming' && !closed
              ? 'Upcoming event'
              : closed
                ? 'Event ended'
                : 'Live event'}</span
          >
          <h2>
            <time datetime={new Date(config.startTime).toISOString()}
              >{date(config.startTime)}</time
            >
          </h2>
          {#if clubMode}
            <p>Event submissions are closed.</p>
          {:else}
            <p>
              {phase === 'upcoming'
                ? 'Starts'
                : closed
                  ? 'Submissions closed'
                  : 'Submissions close'}
              <time
                datetime={new Date(
                  phase === 'upcoming' ? config.startTime : config.endTime
                ).toISOString()}
                >{dateTime(
                  phase === 'upcoming' ? config.startTime : config.endTime
                )} UTC</time
              >.
            </p>
          {/if}
          {#if !closed}
            <div class="home-timing">
              <span
                >{phase === 'upcoming' ? 'Starts in' : 'Time remaining'}</span
              ><strong>{countdown}</strong>
            </div>
          {/if}
        {:else}
          <h2>Event not scheduled</h2>
        {/if}
        <div class="home-actions">
          <Button href={closed ? '/scores' : '/challenges'}
            >{closed
              ? 'View scoreboard'
              : phase === 'live'
                ? 'Enter challenges'
                : 'View challenges'} <span aria-hidden="true">↗</span></Button
          >
        </div>
      {/if}
    </div>
  </section>
</section>

<style>
  .club-home {
    inline-size: 100%;
    block-size: calc(100dvh - var(--header-height));
    min-block-size: 0;
    padding: 1rem;
    display: flex;
    flex-direction: column;
  }
  .eyebrow {
    color: var(--club-muted);
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  h2 {
    font-family: var(--font-display);
    font-style: italic;
    font-weight: 800;
    line-height: 1.1;
    overflow-wrap: anywhere;
  }
  h2 {
    font-size: clamp(2rem, 4vw, 2.75rem);
  }
  .home-feature {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    flex: 1;
    min-block-size: 0;
    display: flex;
    align-items: center;
  }
  .feature-content {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1.25rem;
    min-inline-size: 0;
    max-block-size: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-block: 1rem;
  }
  p {
    color: var(--foreground-l2);
    font-size: 0.875rem;
    line-height: 1.7;
  }
  .home-timing {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 1rem;
  }
  .home-timing span {
    color: var(--club-muted);
    font-size: 0.8125rem;
  }
  .home-timing strong {
    color: var(--club-accent-text);
    font-family: var(--font-mono);
    font-size: 1.5rem;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .home-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-block-start: 0.25rem;
  }
  @media (width < 40rem) {
    .club-home {
      padding: 0.75rem;
    }
    .home-timing {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.5rem;
    }
  }
</style>
