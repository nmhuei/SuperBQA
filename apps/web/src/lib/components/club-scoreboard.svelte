<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import {
    archiveChallengeHref,
    parseArchiveLocation,
  } from '$lib/club/archive-model'
  import {
    clubEventChallengeHref,
    parseClubEventLocation,
    clubEventPhase,
  } from '$lib/club/club-event-model'
  import { useClubEvent } from '$lib/query/club-events'
  import { useClubAccess, useClubArchive } from '$lib/query/club'
  import { useCurrentUser } from '$lib/query/user'
  import { getAuthPageHref } from '$lib/utils/redirect'
  import Button from '$lib/ui/button.svelte'
  import Card from '$lib/ui/card.svelte'
  import Spinner from '$lib/ui/spinner.svelte'
  let { mode = 'archive' }: { mode?: 'archive' | 'event' } = $props()
  const internal = $derived(mode === 'event')
  let now = $state(Date.now())
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 1000)
    return () => clearInterval(timer)
  })
  const userQuery = useCurrentUser()
  const access = useClubAccess()
  const allowed = $derived(
    access.data?.canAccessArchives === true && !access.isError
  )
  const archiveQuery = useClubArchive(
    () => page.params.id ?? '',
    () => allowed && !internal
  )
  const eventQuery = useClubEvent(
    () => page.params.id ?? '',
    () => allowed && internal
  )
  const archive = $derived(internal ? eventQuery : archiveQuery)
  const visibleName = $derived(
    allowed && !archive.isError ? archive.data?.name : undefined
  )
  const loginHref = $derived(
    getAuthPageHref(
      '/login',
      page.url.pathname + page.url.search + page.url.hash,
      page.url.origin
    )
  )
  const challengeHref = $derived(
    internal
      ? clubEventChallengeHref(
          page.params.id ?? '',
          parseClubEventLocation(page.url)
        )
      : archiveChallengeHref(
          page.params.id ?? '',
          parseArchiveLocation(page.url)
        )
  )
</script>

<svelte:head
  ><title>Scoreboard | {visibleName ?? 'UCS archive'}</title></svelte:head
>

<section class="archive-scores" aria-labelledby="archive-scores-title">
  <header>
    <div>
      <span>{visibleName ?? 'Past event'}</span>
      <h1 id="archive-scores-title" data-visually-hidden>Scoreboard</h1>
      <p>
        {internal
          ? eventQuery.data && clubEventPhase(eventQuery.data, now) === 'ended'
            ? 'Final standings'
            : 'Event standings'
          : 'Final standings'}
      </p>
    </div>
    <Button href={challengeHref} variant="outline" size="sm"
      >Back to challenges</Button
    >
  </header>
  {#if access.isPending || (allowed && archive.isPending)}
    <div class="status" role="status">
      <Spinner />
      <p>Loading standings…</p>
    </div>
  {:else if access.isError}
    <Card title="Unable to check access" description={access.error.message}
      ><Button onclick={() => access.refetch()}>Retry</Button></Card
    >
  {:else if !allowed}
    <Card
      title={internal ? 'Members-only event' : 'Members-only archive'}
      description="Log in with Member access to view these standings."
      >{#if userQuery.data}
        <p>Ask a club administrator to grant Member access to your account.</p>
      {:else}
        <Button href={loginHref}>Log in</Button>
      {/if}</Card
    >
  {:else if archive.isError}
    <Card title="Unable to load standings" description={archive.error.message}
      ><Button onclick={() => archive.refetch()}>Retry</Button></Card
    >
  {:else if !archive.data?.leaderboard.length}
    <Card title="No ranked teams"
      ><p>This event has no recorded standings.</p></Card
    >
  {:else}
    <!-- The scroll region is keyboard accessible. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="rankings"
      tabindex="0"
      role="region"
      aria-label="Event standings"
    >
      <table>
        <thead
          ><tr
            ><th scope="col">Rank</th><th scope="col">Team</th><th scope="col"
              >Points</th
            ></tr
          ></thead
        ><tbody>
          {#each archive.data.leaderboard as team (team.id)}
            <tr
              ><td>{team.rank}</td><td>{team.name}</td><td
                >{team.score.toLocaleString()}</td
              ></tr
            >
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<style>
  .archive-scores {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    inline-size: 100%;
    block-size: calc(100dvh - var(--header-height));
    min-block-size: 0;
    padding: 1rem;
  }
  header {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  header span {
    color: var(--club-muted);
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  h1 {
    font-family: var(--font-display);
    font-size: clamp(2.25rem, 4vw, 3rem);
    font-style: italic;
    font-weight: 800;
    line-height: 1.1;
    text-transform: uppercase;
  }
  header p,
  .status p {
    color: var(--club-muted);
    font-size: 0.8125rem;
  }
  .status {
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1;
    gap: 0.75rem;
  }
  .rankings {
    flex: 1;
    overflow: auto;
    min-block-size: 0;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }
  .rankings:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 3px;
  }
  table {
    border-collapse: collapse;
    inline-size: 100%;
    text-align: start;
    font-size: 0.9375rem;
  }
  th {
    position: sticky;
    inset-block-start: 0;
    text-align: start;
    background: var(--background-l0);
    color: var(--club-muted);
    font-weight: 400;
    font-size: 0.75rem;
  }
  td,
  th {
    padding: 1rem 0.75rem;
    border-block-end: 1px solid var(--club-border);
  }
  td:first-child,
  th:first-child {
    inline-size: 5rem;
  }
  td:last-child,
  th:last-child {
    text-align: end;
    font-variant-numeric: tabular-nums;
  }
  td:nth-child(2) {
    overflow-wrap: anywhere;
  }
  tr:last-child td {
    border-block-end: 0;
  }
  @media (width < 40rem) {
    .archive-scores {
      padding: 0.75rem;
    }
    td,
    th {
      padding: 0.875rem 0.5rem;
    }
  }
</style>
