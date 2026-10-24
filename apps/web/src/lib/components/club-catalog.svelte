<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import {
    archiveCatalogHref,
    archiveChallengeHref,
    filterArchives,
  } from '$lib/club/archive-model'
  import {
    clubEventCatalogHref,
    clubEventChallengeHref,
    clubEventPhase,
  } from '$lib/club/club-event-model'
  import { useClubEvents } from '$lib/query/club-events'
  import ClubDetailGeometry from '$lib/components/club-detail-geometry.svelte'
  import { useClubAccess, useClubArchives } from '$lib/query/club'
  import { ApiError } from '$lib/query/core'
  import { useCurrentUser } from '$lib/query/user'
  import Button from '$lib/ui/button.svelte'
  import Card from '$lib/ui/card.svelte'
  import Input from '$lib/ui/input.svelte'
  import Spinner from '$lib/ui/spinner.svelte'

  let { kind = 'archive' }: { kind?: 'archive' | 'events' } = $props()
  const internal = $derived(kind === 'events')
  let now = $state(Date.now())
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 1000)
    return () => clearInterval(timer)
  })
  const catalogueHref = (search = '') =>
    internal ? clubEventCatalogHref(search) : archiveCatalogHref(search)
  const access = useClubAccess()
  const user = useCurrentUser()
  const allowed = $derived(
    access.data?.canAccessArchives === true && !access.isError
  )
  const archiveQuery = useClubArchives(() => allowed && !internal)
  const eventQuery = useClubEvents(() => allowed && internal)
  const archives = $derived(internal ? eventQuery : archiveQuery)
  const rows = $derived(
    internal
      ? (eventQuery.data ?? []).map(event => ({
          ...event,
          practiceChallengeCount: undefined,
          phase: clubEventPhase(event, now),
        }))
      : (archiveQuery.data ?? []).map(event => ({
          ...event,
          phase: 'archive' as const,
        }))
  )
  const query = $derived((page.url.searchParams.get('q') ?? '').slice(0, 200))
  const visible = $derived(filterArchives<(typeof rows)[number]>(rows, query))
  const denied = $derived(
    archives.error instanceof ApiError &&
      ['badToken', 'badPerms'].includes(archives.error.kind)
  )
  const loginHref = $derived(
    `/login?next=${encodeURIComponent(catalogueHref(query))}`
  )
  function search(value: string) {
    void goto(catalogueHref(value), {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
    })
  }
  const month = (time: number) =>
    new Date(time).toLocaleDateString('en', { month: 'short', timeZone: 'UTC' })
  const year = (time: number) => new Date(time).getUTCFullYear()
  $effect(() => {
    if (denied) void access.refetch()
  })
</script>

<svelte:head
  ><title>{internal ? 'Club events' : 'Archive'} | UCS</title></svelte:head
>
<section class="archive-page" aria-labelledby="archive-title">
  <h1 id="archive-title" data-visually-hidden>
    {internal ? 'Club events' : 'Archive'}
  </h1>
  {#if access.isPending || (allowed && archives.isPending)}
    <div class="status" role="status">
      <Spinner />
      <p>Loading events…</p>
    </div>
  {:else if access.isError}
    <div class="status">
      <Card title="Unable to check access" description={access.error.message}
        ><Button onclick={() => access.refetch()}>Retry</Button></Card
      >
    </div>
  {:else if !allowed || denied}
    <div class="status">
      <Card
        title={internal ? 'Members-only events' : 'Members-only archive'}
        description={user.data
          ? 'Ask a club administrator for Member access.'
          : 'Log in with a member account to continue.'}
      >
        {#if !user.data}<Button href={loginHref}>Log in</Button>{:else}<Button
            href="/"
            variant="outline">Home</Button
          >{/if}
      </Card>
    </div>
  {:else if archives.isError}
    <div class="status">
      <Card title="Unable to load events" description={archives.error.message}
        ><Button onclick={() => archives.refetch()}>Retry</Button></Card
      >
    </div>
  {:else if !archives.data?.length}
    <div class="status">
      <Card
        title={internal ? 'No club events yet' : 'No archived events yet'}
        description={internal
          ? 'Published internal events will appear here.'
          : 'Past events will appear here when a club administrator publishes an archive.'}
      >
        {#if access.data?.canManageArchives}<Button
            href={internal ? '/admin/club/events' : '/admin/club'}
            >Manage events</Button
          >{/if}
      </Card>
    </div>
  {:else}
    <div class="archive-toolbar">
      <label class="search-field"
        ><span data-visually-hidden>Find an event</span><Input
          value={query}
          oninput={event => search(event.currentTarget.value)}
          placeholder="Find an event…"
          maxlength={200}
        /></label
      >
      {#if query}<Button variant="ghost" size="sm" onclick={() => search('')}
          >Clear</Button
        >{/if}
      <Button
        href={internal ? '/archive' : '/club/events'}
        variant="ghost"
        size="sm">{internal ? 'Archive' : 'Club events'}</Button
      >
    </div>
    <!-- The event catalogue is a keyboard-scrollable reading region. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="archive-grid"
      role="region"
      aria-label={internal ? 'Club events' : 'Past events'}
      tabindex="0"
    >
      {#each visible as event (event.id)}
        {@const available = event.practiceChallengeCount}
        {@const solved = Math.min(event.solvedCount ?? 0, available ?? 0)}
        <a
          class="event-card"
          href={internal
            ? clubEventChallengeHref(event.id, { catalogQuery: query })
            : archiveChallengeHref(event.id, { catalogQuery: query })}
          aria-label={`Open challenges: ${event.name}`}
        >
          <div class="event-cover" aria-hidden="true">
            <ClubDetailGeometry /><span>{month(event.endTime)}</span><strong
              >{year(event.endTime)}</strong
            >
          </div>
          <div class="event-content">
            <h2>{event.name}</h2>
            {#if internal}<p
                class="event-phase"
                data-live={event.phase === 'live' || undefined}
              >
                {event.phase === 'live'
                  ? 'Live'
                  : event.phase === 'upcoming'
                    ? 'Upcoming'
                    : event.phase === 'draft'
                      ? 'Draft'
                      : 'Ended'} · {new Date(
                  event.phase === 'upcoming' ? event.startTime : event.endTime
                ).toLocaleString('en', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>{/if}
            {#if event.description}<p class="description">
                {event.description}
              </p>{/if}
            <div class="event-meta">
              {#if available !== undefined}<span
                  >{available} practice {available === 1
                    ? 'challenge'
                    : 'challenges'}</span
                >
                {#if event.challengeCount > available}<span
                    >{event.challengeCount - available} reference-only</span
                  >{/if}
              {:else}<span>{event.challengeCount} challenges</span>{/if}
            </div>
            {#if available !== undefined && available > 0}
              <div class="practice-progress">
                <span>{solved}/{available} solved</span><progress
                  value={solved}
                  max={available}
                  aria-label={`Practice progress: ${event.name}`}
                ></progress>
              </div>
            {/if}
            <span class="open-event"
              >{internal
                ? 'Open event'
                : solved > 0
                  ? 'Continue practice'
                  : 'Open challenges'}<span aria-hidden="true">↗</span></span
            >
          </div>
        </a>
      {:else}<div class="no-matches">
          <p>No events match this search.</p>
          <Button variant="outline" onclick={() => search('')}
            >Clear search</Button
          >
        </div>{/each}
    </div>
  {/if}
</section>

<style>
  .archive-page {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    inline-size: 100%;
    block-size: calc(100dvh - var(--header-height));
    min-block-size: 0;
    padding: 1rem;
  }
  .archive-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }
  .search-field {
    inline-size: min(100%, 26rem);
  }
  .archive-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
    grid-auto-rows: max-content;
    gap: 1rem;
    align-content: start;
    flex: 1;
    min-block-size: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    padding: 0.125rem;
  }
  .archive-grid:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: -2px;
  }
  .event-card {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    overflow: hidden;
    border: 1px solid var(--club-border);
    border-radius: var(--radius-lg);
    background: var(--club-panel);
    color: inherit;
    text-decoration: none;
    transition:
      border-color 0.15s,
      background-color 0.15s;
  }
  .event-card:hover {
    border-color: var(--club-accent-text);
  }
  .event-card:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: -2px;
  }
  .event-cover {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    display: flex;
    justify-content: space-between;
    align-items: end;
    min-block-size: 7rem;
    padding: 1rem;
    border-block-end: 1px solid var(--club-border);
    color: var(--club-accent-text);
  }
  .event-cover > span {
    font-family: var(--font-display);
    font-style: italic;
    font-weight: 800;
    font-size: 2.75rem;
    line-height: 1;
    text-transform: uppercase;
  }
  .event-cover > strong {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    font-weight: 500;
  }
  .event-content {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    flex: 1;
    min-inline-size: 0;
    padding: 1rem;
  }
  h2 {
    font-size: 1.125rem;
    line-height: 1.35;
    font-weight: 650;
    overflow-wrap: anywhere;
  }
  .description {
    color: var(--foreground-l2);
    font-size: 0.8125rem;
    line-height: 1.65;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    overflow-wrap: anywhere;
  }
  .event-phase {
    font-size: 0.75rem;
    color: var(--club-muted);
  }
  .event-phase[data-live] {
    color: var(--club-accent-text);
  }
  .event-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 1rem;
    color: var(--club-muted);
    font-size: 0.75rem;
  }
  .practice-progress {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    color: var(--foreground-l2);
    font-size: 0.75rem;
  }
  progress {
    appearance: none;
    inline-size: 100%;
    block-size: 0.25rem;
    border: 0;
    border-radius: 0.25rem;
    overflow: hidden;
    background: var(--background-l3);
  }
  progress::-webkit-progress-bar {
    background: var(--background-l3);
  }
  progress::-webkit-progress-value {
    background: var(--club-accent-text);
  }
  progress::-moz-progress-bar {
    background: var(--club-accent-text);
  }
  .open-event {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-block-start: 0.75rem;
    margin-block-start: auto;
    color: var(--club-accent-text);
    font-size: 0.8125rem;
    font-weight: 600;
    border-block-start: 1px solid var(--club-border);
  }
  .status {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: var(--club-muted);
  }
  .status :global(ui-card) {
    max-inline-size: 32rem;
  }
  .no-matches {
    grid-column: 1/-1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 3rem 1rem;
    color: var(--club-muted);
    font-size: 0.875rem;
  }
  @media (width < 40rem) {
    .archive-page {
      padding: 0.75rem;
    }
    .archive-grid {
      gap: 0.75rem;
    }
    .event-card {
      flex-direction: row;
    }
    .event-cover {
      inline-size: 5.5rem;
      flex-shrink: 0;
      flex-direction: column;
      align-items: start;
      justify-content: space-between;
      padding: 0.75rem;
      border-block-end: 0;
      border-inline-end: 1px solid var(--club-border);
    }
    .event-cover > span {
      font-size: 2rem;
    }
    .event-content {
      padding: 0.875rem;
    }
    h2 {
      font-size: 1rem;
    }
  }
</style>
