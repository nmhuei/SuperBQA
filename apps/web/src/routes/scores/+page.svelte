<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { clubEventPhase, prioritizeClubEvents } from '$lib/club/club-event-model'
  import CtfNotStarted from '$lib/components/ctf-not-started.svelte'
  import { IconFlagBanner, IconSearch, IconTrophy } from '$lib/icons'
  import { useClubEvents, useClubEvent } from '$lib/query/club-events'
  import { useClientConfig } from '$lib/query/config'
  import EmptyState from '$lib/ui/empty-state.svelte'
  import Spinner from '$lib/ui/spinner.svelte'
  import ScoresLeaderboard from './leaderboard/leaderboard.svelte'
  import { createEventScoresData, createScoresData } from './model/data.svelte'
  import { createScoresRouteState } from './model/url-state.svelte'
  import ScoresScreenshotContainer from './screenshot/screenshot-container.svelte'
  import ScoresToolbar from './toolbar/toolbar.svelte'
  import ScoresEventSelect from './scores-event-select.svelte'

  const configQuery = useClientConfig()
  const ctfName = $derived(configQuery.data?.ctfName ?? 'UCS CTF')
  const divisions = $derived(configQuery.data?.divisions ?? {})

  let now = $state(Date.now())
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 1000)
    return () => clearInterval(timer)
  })

  const eventsQuery = useClubEvents(() => true)
  const events = $derived(eventsQuery.data ?? [])

  const prioritizedEvents = $derived(prioritizeClubEvents(events, now))

  const urlEventId = $derived(page.url.searchParams.get('event'))
  const selectedEventId = $derived.by(() => {
    if (!events.length) return null
    if (urlEventId && events.some(e => e.id === urlEventId)) {
      return urlEventId
    }
    return prioritizedEvents[0]?.id ?? null
  })

  function handleSelectEvent(id: string) {
    const targetUrl = new URL(page.url)
    targetUrl.searchParams.set('event', id)
    void goto(targetUrl.pathname + targetUrl.search, {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
    })
  }

  const selectedEvent = $derived(
    events.find(e => e.id === selectedEventId) ?? null
  )

  const eventDetailQuery = useClubEvent(
    () => selectedEventId ?? '',
    () => !!selectedEventId
  )

  const urlState = createScoresRouteState()

  const eventScoresData = createEventScoresData(
    eventDetailQuery,
    {
      division: () => urlState.division,
      search: () => urlState.search,
      sortMode: () => urlState.sortMode,
      focusedChallengeId: () => urlState.focusedChallengeId,
      showTop3Context: () => urlState.showTop3Context,
      showSelfContext: () => urlState.showSelfContext,
    },
    () => selectedEvent?.startTime ?? 0
  )

  const globalScoresData = createScoresData({
    division: () => urlState.division,
    search: () => urlState.search,
    sortMode: () => urlState.sortMode,
    focusedChallengeId: () => urlState.focusedChallengeId,
    showTop3Context: () => urlState.showTop3Context,
    showSelfContext: () => urlState.showSelfContext,
  })

  const data = $derived(selectedEventId ? eventScoresData : globalScoresData)

  const startTime = $derived(
    selectedEvent?.startTime ?? configQuery.data?.startTime ?? 0
  )
  const endTime = $derived(
    selectedEvent?.endTime ?? configQuery.data?.endTime ?? null
  )

  const revealAfterLoading = $derived(data.isLoading)
  let screenshotOpen = $state(false)

  const focusFetching = $derived(
    !!urlState.focusedChallengeId &&
      data.entries.length === 0 &&
      (data.hasNextPage || data.isFetchingNextPage)
  )
</script>

<svelte:head>
  <title>Scores {selectedEvent ? `| ${selectedEvent.name}` : ''} | {ctfName}</title>
</svelte:head>

<scores-page>
  {#if events.length > 0}
    <div class="scores-events-bar">
      <span class="events-bar-label">Club events:</span>
      <ScoresEventSelect
        {events}
        {selectedEventId}
        {now}
        onselect={handleSelectEvent}
      />
    </div>
  {/if}

  {#if data.isNotStarted}
    <scores-leaderboard-slot>
      <CtfNotStarted />
    </scores-leaderboard-slot>
  {:else}
    <ScoresToolbar
      {data}
      {urlState}
      {divisions}
      onScreenshot={() => (screenshotOpen = true)}
    />

    {#if data.isLoading || focusFetching}
      <scores-leaderboard-slot>
        <Spinner />
      </scores-leaderboard-slot>
    {:else if data.loadError && data.entries.length === 0}
      <scores-leaderboard-slot>
        <EmptyState
          icon={IconTrophy}
          title="Couldn't load the scoreboard"
          subtitle={data.loadError.message}
        />
      </scores-leaderboard-slot>
    {:else if data.entries.length > 0}
      <scores-frame data-reveal={revealAfterLoading || undefined}>
        <ScoresLeaderboard {data} {urlState} {divisions} {startTime} />
      </scores-frame>
    {:else}
      <scores-leaderboard-slot>
        {#if urlState.focusedChallengeId}
          <EmptyState
            icon={IconFlagBanner}
            title="No solves"
            subtitle="No matching teams have solved this challenge."
          />
        {:else if urlState.search}
          <EmptyState
            icon={IconSearch}
            title="No teams found"
            subtitle="Try a different search term."
          />
        {:else}
          <EmptyState
            icon={IconTrophy}
            title="No scores yet"
            subtitle="Check back once teams start solving."
          />
        {/if}
      </scores-leaderboard-slot>
    {/if}

    {#if screenshotOpen}
      <ScoresScreenshotContainer
        open={screenshotOpen}
        onOpenChange={open => (screenshotOpen = open)}
        {urlState}
        ctfName={selectedEvent?.name ?? ctfName ?? ''}
        {startTime}
        {endTime}
      />
    {/if}
  {/if}
</scores-page>

<style>
  scores-page {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-block-size: 0;
    block-size: calc(100dvh - var(--header-height));
    max-block-size: calc(100dvh - var(--header-height));
    overflow: hidden;
    padding-block-end: 1rem;
  }

  .scores-events-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding-inline: 1rem;
    padding-block: 0.625rem;
    background: var(--background-l1);
    border-block-end: 1px solid var(--club-border);
    overflow-x: auto;
    scrollbar-width: thin;
    flex-shrink: 0;
  }

  .events-bar-label {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--club-muted);
    white-space: nowrap;
  }

  scores-frame {
    display: flex;
    flex: 1;
    inline-size: 100%;
    min-block-size: 0;
    max-inline-size: 100%;
    padding-inline: 1rem;

    @media (width < 40rem) {
      padding-inline: 0.75rem;
    }
  }

  scores-leaderboard-slot {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    min-block-size: 0;
  }
</style>
