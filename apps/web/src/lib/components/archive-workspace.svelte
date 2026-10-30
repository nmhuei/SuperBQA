<script lang="ts">
  import { BadClubArchive, BadClubEvent, BadPerms, BadToken } from '@rctf/types'
  import { goto, replaceState } from '$app/navigation'
  import { page } from '$app/state'
  import {
    archiveCatalogHref,
    archiveChallengeHref,
    parseArchiveLocation,
    practiceProgress,
  } from '$lib/club/archive-model'
  import {
    clubEventCatalogHref,
    clubEventChallengeHref,
    clubEventPhase,
    parseClubEventLocation,
  } from '$lib/club/club-event-model'
  import {
    filterArchiveChallenges,
    groupArchiveChallenges,
    loadArchiveCollapsedCategories,
    saveArchiveCollapsedCategories,
  } from '$lib/club/archive-list-model'
  import {
    IconArrowsInLineVertical,
    IconCaretDown,
    IconCheck,
    IconEye,
    IconEyeClosed,
    IconFlagBanner,
    IconQuestion,
  } from '$lib/icons'
  import {
    useClubAccess,
    useClubArchive,
    useClubArchives,
  } from '$lib/query/club'
  import { useClubEvent, useClubEvents } from '$lib/query/club-events'
  import { ApiError } from '$lib/query/core'
  import { useCurrentUser } from '$lib/query/user'
  import Accordion from '$lib/ui/accordion.svelte'
  import Button from '$lib/ui/button.svelte'
  import EmptyState from '$lib/ui/empty-state.svelte'
  import Input from '$lib/ui/input.svelte'
  import Spinner from '$lib/ui/spinner.svelte'
  import Splitter from '$lib/ui/splitter.svelte'
  import { getCategoryConfig } from '$lib/utils/categories'
  import { handlePaneArrowKey } from '$lib/utils/pane-keynav'
  import { onMount } from 'svelte'
  import ArchiveChallengeDetail from './archive-challenge-detail.svelte'
  import CategoryMural from './category-mural.svelte'
  import ChallengeBackdrop from './challenge-backdrop.svelte'
  import ClubDetailGeometry from './club-detail-geometry.svelte'

  let {
    archiveId,
    mode = 'practice',
  }: { archiveId: string; mode?: 'practice' | 'event' } = $props()

  const access = useClubAccess()
  const user = useCurrentUser()
  const isAuthenticated = $derived(!!user.data && !user.isError)
  const allowed = $derived(
    mode === 'event'
      ? isAuthenticated
      : access.data?.canAccessArchives === true &&
        !access.isError &&
        !access.isPending
  )
  const archive = useClubArchive(
    () => archiveId,
    () => allowed && mode === 'practice'
  )
  const archives = useClubArchives(() => allowed && mode === 'practice')
  const privateEvent = useClubEvent(
    () => archiveId,
    () => allowed && mode === 'event'
  )
  const privateEvents = useClubEvents(() => allowed && mode === 'event')
  const detailQuery = $derived(mode === 'event' ? privateEvent : archive)
  const catalogQuery = $derived(mode === 'event' ? privateEvents : archives)
  const location = $derived(
    mode === 'event'
      ? parseClubEventLocation(page.url)
      : parseArchiveLocation(page.url)
  )
  const workspaceHref = $derived(
    mode === 'event' ? clubEventChallengeHref : archiveChallengeHref
  )
  const permissionError = $derived(
    [detailQuery.error, catalogQuery.error].some(
      error =>
        error instanceof ApiError &&
        (error.kind === BadPerms.kind || error.kind === BadToken.kind)
    )
  )
  const ready = $derived(
    allowed &&
      !permissionError &&
      !detailQuery.isError &&
      detailQuery.data?.id === archiveId
  )
  const event = $derived(ready ? detailQuery.data : undefined)
  const scheduledEvent = $derived(
    mode === 'event' && ready ? privateEvent.data : undefined
  )
  let now = $state(Date.now())
  const phase = $derived(
    scheduledEvent ? clubEventPhase(scheduledEvent, now) : null
  )
  const canPreview = $derived(access.data?.canManageArchives === true)
  const hideBeforeStart = $derived(
    mode === 'event' &&
      !canPreview &&
      (phase === 'upcoming' || phase === 'draft')
  )
  const challenges = $derived(hideBeforeStart ? [] : (event?.challenges ?? []))
  const submissionOpen = $derived(mode === 'practice' || phase === 'live')
  const closedMessage = $derived(
    phase === 'draft'
      ? 'This event is a draft. Submissions open after it is published and starts.'
      : phase === 'upcoming' && scheduledEvent
        ? `Submissions open ${formatDateTime(scheduledEvent.startTime)}.`
        : 'This event has ended. Submissions are closed.'
  )
  const solvedIds = $derived(new Set(event?.solvedIds ?? []))
  const progress = $derived(practiceProgress(challenges, solvedIds))
  let localChallengeId = $state<string | null>(null)
  const selectedId = $derived(localChallengeId ?? location.challengeId)
  const selected = $derived(
    challenges.find(challenge => challenge.id === selectedId) ?? null
  )

  $effect(() => {
    localChallengeId = location.challengeId
  })
  const filtered = $derived(
    filterArchiveChallenges(challenges, {
      query: location.query,
      hideSolved: location.hideSolved,
      solvedIds,
    })
  )
  const groups = $derived(groupArchiveChallenges(filtered))
  const groupByCategory = $derived(
    new Map(groups.map(group => [group.category, group]))
  )
  const categories = $derived(groups.map(group => group.category))
  const catalogHref = $derived(
    mode === 'event'
      ? clubEventCatalogHref(location.catalogQuery)
      : archiveCatalogHref(location.catalogQuery)
  )
  const listHref = $derived(
    workspaceHref(archiveId, {
      query: location.query,
      hideSolved: location.hideSolved,
      catalogQuery: location.catalogQuery,
    })
  )
  const eventOptions = $derived(
    !ready || catalogQuery.isError
      ? []
      : mode === 'event'
        ? (privateEvents.data ?? []).filter(
            option => option.published || option.id === archiveId
          )
        : (archives.data ?? [])
  )
  const searchActive = $derived(location.query.trim().length > 0)
  let collapsedCategories = $state<string[]>([])
  let innerWidth = $state(0)
  const isMobile = $derived(innerWidth > 0 && innerWidth < 768)
  const openCategories = $derived(
    categories.filter(
      category => searchActive || !collapsedCategories.includes(category)
    )
  )
  const anyOpen = $derived(openCategories.length > 0)
  const componentId = $props.id()

  onMount(() => {
    collapsedCategories = loadArchiveCollapsedCategories(
      archiveId,
      undefined,
      mode
    )
    if (mode !== 'event') return
    const timer = setInterval(() => (now = Date.now()), 1000)
    return () => clearInterval(timer)
  })

  let previousPhase: typeof phase = null
  $effect(() => {
    const currentPhase = phase
    if (
      (previousPhase === 'upcoming' && currentPhase === 'live') ||
      (previousPhase === 'live' && currentPhase === 'ended')
    )
      void privateEvent.refetch()
    previousPhase = currentPhase
  })

  $effect(() => {
    if (permissionError) void access.refetch()
  })

  function selectChallenge(challengeId: string, event: MouseEvent) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0)
      return
    event.preventDefault()
    localChallengeId = challengeId
    void replaceState(challengeHref(challengeId), { ...page.state })
  }

  function challengeHref(challengeId: string) {
    return workspaceHref(archiveId, {
      challengeId,
      query: location.query,
      hideSolved: location.hideSolved,
      catalogQuery: location.catalogQuery,
    })
  }

  function updateFilters(query: string, hideSolved: boolean) {
    void goto(
      workspaceHref(archiveId, {
        challengeId: selectedId,
        query,
        hideSolved,
        catalogQuery: location.catalogQuery,
      }),
      { replaceState: true, noScroll: true, keepFocus: true }
    )
  }

  function updateCollapsed(open: string[]) {
    if (searchActive) return
    const shown = new Set(categories)
    const expanded = new Set(open)
    collapsedCategories = [
      ...collapsedCategories.filter(category => !shown.has(category)),
      ...categories.filter(category => !expanded.has(category)),
    ]
    saveArchiveCollapsedCategories(
      archiveId,
      collapsedCategories,
      undefined,
      mode
    )
  }

  function closeDetail() {
    localChallengeId = null
    void replaceState(listHref, { ...page.state })
  }

  async function retryEvent() {
    const refreshed = await access.refetch()
    if (!refreshed.isError && refreshed.data?.canAccessArchives) {
      await Promise.all([detailQuery.refetch(), catalogQuery.refetch()])
    }
  }

  function formatDateTime(time: number) {
    return new Date(time).toLocaleString('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }
</script>

<svelte:window bind:innerWidth />

<svelte:head>
  <title
    >{event?.name ?? (mode === 'event' ? 'Club event' : 'Archived event')} | {mode ===
    'event'
      ? 'Challenges'
      : 'Practice'}</title
  >
</svelte:head>

{#snippet listPane()}
  <section
    class="challenge-list"
    aria-label={mode === 'event' ? 'Event challenges' : 'Archived challenges'}
  >
    <div class="list-controls">
      <div class="search-control">
        <Input
          type="search"
          aria-label="Search challenges"
          placeholder="Search challenges…"
          value={location.query}
          oninput={input =>
            updateFilters(input.currentTarget.value, location.hideSolved)}
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
        />
      </div>
      <Button
        variant={location.hideSolved ? 'default' : 'secondary'}
        size="icon"
        aria-pressed={location.hideSolved}
        aria-label={location.hideSolved
          ? 'Show solved challenges'
          : 'Hide solved challenges'}
        title={location.hideSolved
          ? 'Show solved challenges'
          : 'Hide solved challenges'}
        onclick={() => updateFilters(location.query, !location.hideSolved)}
      >
        {#if location.hideSolved}<IconEyeClosed />{:else}<IconEye />{/if}
      </Button>
      <Button
        variant="secondary"
        size="icon"
        disabled={searchActive || categories.length === 0}
        aria-label={anyOpen
          ? 'Collapse all categories'
          : 'Expand all categories'}
        title={searchActive
          ? 'Categories stay open while searching'
          : anyOpen
            ? 'Collapse all categories'
            : 'Expand all categories'}
        onclick={() => updateCollapsed(anyOpen ? [] : categories)}
        ><IconArrowsInLineVertical /></Button
      >
    </div>

    <div class="list-scroll" tabindex="-1">
      {#if challenges.length === 0}
        <EmptyState
          icon={IconFlagBanner}
          title="No challenges in this event"
          subtitle={mode === 'event'
            ? 'Choose another club event to continue.'
            : 'Choose another archived event to practice.'}
        />
        <div class="empty-action">
          <Button href={catalogHref} variant="outline">Browse events</Button>
        </div>
      {:else if groups.length === 0}
        <EmptyState
          icon={IconQuestion}
          title="No challenges found"
          subtitle={location.hideSolved
            ? 'Try another search or show solved challenges.'
            : 'Try a different search.'}
        />
        <div class="empty-action">
          <Button variant="outline" onclick={() => updateFilters('', false)}
            >Clear filters</Button
          >
        </div>
      {:else}
        <Accordion
          items={categories}
          value={openCategories}
          onValueChange={updateCollapsed}
        >
          {#snippet header({ value, props, expanded })}
            {@const config = getCategoryConfig(value)}
            {@const entries = groupByCategory.get(value)?.challenges ?? []}
            <div class="category-header" data-category-color={config.color}>
              <button {...props} data-expanded={expanded || undefined}>
                <CategoryMural
                  category={value}
                  index={categories.indexOf(value)}
                  count={categories.length}
                />
                <span class="category-name">{config.name}</span>
                <span class="category-count">{entries.length}</span>
                <IconCaretDown data-slot="chevron" />
              </button>
            </div>
          {/snippet}
          {#snippet content({ value, props })}
            {@const config = getCategoryConfig(value)}
            {@const entries = groupByCategory.get(value)?.challenges ?? []}
            <div
              class="category-body"
              data-category-color={config.color}
              {...props}
            >
              <ul>
                {#each entries as challenge, index (challenge.id)}
                  {@const solved = solvedIds.has(challenge.id)}
                  <li>
                    <a
                      class="challenge-row"
                      href={challengeHref(challenge.id)}
                      data-sveltekit-noscroll
                      aria-current={selectedId === challenge.id
                        ? 'true'
                        : undefined}
                      data-selected={selectedId === challenge.id
                        ? ''
                        : undefined}
                      data-solved={solved ? '' : undefined}
                      onclick={event => selectChallenge(challenge.id, event)}
                    >
                      <ChallengeBackdrop
                        id={challenge.id}
                        category={value}
                        {index}
                        count={entries.length}
                      />
                      {#if solved}<IconCheck data-slot="solved" /><span
                          class="sr-only"
                          >Solved:
                        </span>{/if}
                      <span class="challenge-copy">
                        <span class="challenge-name">{challenge.name}</span>
                        <span class="challenge-author"
                          >{challenge.author || config.name}</span
                        >
                      </span>
                      <span class="challenge-meta">
                        {#if challenge.practiceAvailable}
                          <span class="challenge-points"
                            ><strong>{challenge.points.toLocaleString()}</strong
                            > pts</span
                          >
                          {#if solved}
                            <span class="challenge-status">Solved</span>
                          {/if}
                        {:else}
                          <span class="reference-label">Reference only</span>
                        {/if}
                      </span>
                    </a>
                  </li>
                {/each}
              </ul>
            </div>
          {/snippet}
        </Accordion>
      {/if}
    </div>
  </section>
{/snippet}

{#snippet detailPane()}
  {#each selected ? [selected] : [] as selectedChallenge (selectedChallenge.id)}
    <ArchiveChallengeDetail
      {archiveId}
      {mode}
      {submissionOpen}
      {closedMessage}
      challenge={selectedChallenge}
      solved={solvedIds.has(selectedChallenge.id)}
      allowed={ready}
      onClose={isMobile ? closeDetail : undefined}
    />
  {:else}
    <div class="detail-placeholder">
      <ClubDetailGeometry seed={archiveId} />
      <EmptyState
        icon={selectedId ? IconQuestion : IconFlagBanner}
        title={selectedId
          ? 'Challenge not found'
          : challenges.length
            ? 'Choose a challenge'
            : 'No challenges in this event'}
        subtitle={selectedId
          ? 'This challenge is not part of the selected event.'
          : challenges.length
            ? mode === 'event'
              ? 'Select a challenge to get started.'
              : 'Select a challenge to continue your practice.'
            : mode === 'event'
              ? 'Browse club events to find another event.'
              : 'Browse the archive to find another event.'}
      />
      {#if selectedId}
        <Button
          href={listHref}
          onclick={event => {
            event.preventDefault()
            closeDetail()
          }}
          variant="outline">Back to challenges</Button
        >
      {:else if challenges.length === 0}
        <Button href={catalogHref} variant="outline">Browse events</Button>
      {/if}
    </div>
  {/each}
{/snippet}

<section
  class="archive-workspace"
  aria-label={mode === 'event'
    ? 'Club event challenges'
    : 'Archived event practice'}
>
  {#if access.isPending}
    <div class="workspace-status">
      <Spinner label="Checking member access" />
      <p>Checking member access…</p>
    </div>
  {:else if access.isError}
    <div class="workspace-status">
      <h1>Unable to check access</h1>
      <p>{access.error.message}</p>
      <Button onclick={() => access.refetch()}>Retry</Button>
    </div>
  {:else if !allowed}
    <div class="workspace-status">
      <h1>
        {mode === 'event' ? 'Members-only event' : 'Members-only archive'}
      </h1>
      <p>
        {user.data
          ? mode === 'event'
            ? 'Ask a club administrator for Member access to join club events.'
            : 'Ask a club administrator for Member access to practice past challenges.'
          : mode === 'event'
            ? 'Log in with a member account to join this event.'
            : 'Log in with a member account to practice past challenges.'}
      </p>
      {#if !user.data}
        <Button
          href={`/login?next=${encodeURIComponent(`${page.url.pathname}${page.url.search}`)}`}
          >Log in</Button
        >
      {:else}<Button href={catalogHref} variant="outline"
          >{mode === 'event' ? 'Back to events' : 'Back to archive'}</Button
        >{/if}
    </div>
  {:else if permissionError}
    <div class="workspace-status">
      <h1>
        {mode === 'event' ? 'Event access changed' : 'Archive access changed'}
      </h1>
      <p>Member access is required to continue.</p>
      <div class="status-actions">
        <Button onclick={retryEvent}>Check access</Button><Button
          href={catalogHref}
          variant="outline"
          >{mode === 'event' ? 'Back to events' : 'Back to archive'}</Button
        >
      </div>
    </div>
  {:else if !archiveId}
    <div class="workspace-status">
      <h1>
        {mode === 'event' ? 'Club event not found' : 'Archived event not found'}
      </h1>
      <p>This link does not contain a valid event ID.</p>
      <Button href={catalogHref} variant="outline">Browse events</Button>
    </div>
  {:else if detailQuery.isPending}
    <div class="workspace-status">
      <Spinner label="Loading event" />
      <p>
        {mode === 'event' ? 'Loading club event…' : 'Loading archived event…'}
      </p>
    </div>
  {:else if detailQuery.isError}
    {@const missing =
      detailQuery.error instanceof ApiError &&
      (detailQuery.error.kind === BadClubArchive.kind ||
        detailQuery.error.kind === BadClubEvent.kind)}
    <div class="workspace-status">
      <h1>
        {missing
          ? mode === 'event'
            ? 'Club event not found'
            : 'Archived event not found'
          : 'Unable to load this event'}
      </h1>
      <p>
        {missing
          ? 'This event is no longer available at this link.'
          : detailQuery.error.message}
      </p>
      <div class="status-actions">
        {#if !missing}<Button onclick={retryEvent}>Retry</Button>{/if}
        <Button href={catalogHref} variant="outline">Browse events</Button>
      </div>
    </div>
  {:else if event}
    <header class="event-toolbar">
      <Button href={catalogHref} variant="ghost" size="sm"
        ><span aria-hidden="true">←</span>
        {mode === 'event' ? 'Events' : 'Archive'}</Button
      >
      <div class="event-heading">
        {#if mode !== 'event'}
          <span class="practice-label">Practice</span>
          {#if eventOptions.length > 1}
            <label class="sr-only" for={`${componentId}-event`}>Archived event</label>
            <select
              id={`${componentId}-event`}
              value={archiveId}
              onchange={input =>
                void goto(
                  workspaceHref(input.currentTarget.value, {
                    catalogQuery: location.catalogQuery,
                  }),
                  { noScroll: true }
                )}
            >
              {#if !eventOptions.some(option => option.id === archiveId)}<option
                  value={archiveId}>{event.name}</option
                >{/if}
              {#each eventOptions as option (option.id)}<option value={option.id}
                  >{option.name}</option
                >{/each}
            </select>
          {:else}
            <h1 class="event-title-static">{event.name}</h1>
          {/if}
        {:else}
          <h1 class="event-title-static">{event.name}</h1>
        {/if}
      </div>
      <div class="toolbar-actions">
        {#if scheduledEvent?.archiveId}
          <Button
            href={archiveChallengeHref(scheduledEvent.archiveId)}
            variant="outline"
            size="sm">Practice</Button
          >
        {/if}
        {#if !hideBeforeStart}
          <span
            class="practice-progress"
            title={progress.referenceOnly
              ? `${progress.referenceOnly} reference-only challenges are excluded`
              : mode === 'event'
                ? 'Your event progress'
                : 'Your practice progress'}
          >
            <strong>{progress.solved}</strong><span>
              / {progress.total} solved</span
            >
          </span>
        {/if}
      </div>
    </header>
    {#if hideBeforeStart && scheduledEvent}
      <div class="workspace-status upcoming-state">
        <IconFlagBanner />
        <h2>Upcoming event</h2>
        <p>
          Challenges open <time
            datetime={new Date(scheduledEvent.startTime).toISOString()}
            >{formatDateTime(scheduledEvent.startTime)}</time
          >.
        </p>
        <Button href={catalogHref} variant="outline">Browse events</Button>
      </div>
    {:else if isMobile}
      <div class="workspace-panes" data-form="mobile">
        {#if selectedId}
          <pane-surface data-side="detail">{@render detailPane()}</pane-surface>
        {:else}<pane-surface data-side="list">{@render listPane()}</pane-surface
          >{/if}
      </div>
    {:else}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="workspace-panes"
        data-form="desktop"
        onkeydown={handlePaneArrowKey}
      >
        <Splitter
          panels={[
            {
              id: 'archive-list',
              minSize: innerWidth < 1280 ? 40 : 25,
              maxSize: 50,
            },
            { id: 'archive-detail', minSize: 40 },
          ]}
          defaultSize={[40, 60]}
        >
          {#snippet a()}<pane-surface data-side="list"
              >{@render listPane()}</pane-surface
            >{/snippet}
          {#snippet b()}<pane-surface data-side="detail"
              >{@render detailPane()}</pane-surface
            >{/snippet}
        </Splitter>
      </div>
    {/if}
  {:else}
    <div class="workspace-status">
      <Spinner label="Loading event" />
      <p>
        {mode === 'event' ? 'Loading club event…' : 'Loading archived event…'}
      </p>
    </div>
  {/if}
</section>

<style>
  .archive-workspace {
    display: flex;
    flex-direction: column;
    inline-size: 100%;
    block-size: calc(100dvh - var(--header-height));
    min-block-size: 0;
    --splitter-handle-size: 0.5rem;
  }
  .event-toolbar {
    display: flex;
    align-items: center;
    gap: var(--space-s);
    min-inline-size: 0;
    padding: 0.6rem 1.25rem;
    flex-shrink: 0;
  }
  .event-heading {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 0.65rem;
    min-inline-size: 0;
  }
  .practice-label {
    flex-shrink: 0;
    white-space: nowrap;
    padding: 0.2rem 0.55rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-full);
    font-size: var(--step--2);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--foreground-l3);
  }
  h1,
  select {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--step-0);
    color: var(--foreground-l1);
  }
  .event-title-static {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--foreground-l0);
    letter-spacing: -0.01em;
  }
  select {
    cursor: pointer;
    background: var(--background-l1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0.35rem 0.5rem;
  }
  select:focus-visible {
    outline: 2px solid var(--ring);
  }
  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: var(--space-s);
  }
  .practice-progress {
    white-space: nowrap;
    font-size: var(--step--1);
    font-variant-numeric: tabular-nums;
    color: var(--foreground-l4);
  }
  .practice-progress strong {
    color: var(--foreground-l1);
    font-weight: var(--font-weight-normal);
  }
  .workspace-panes {
    flex: 1;
    min-block-size: 0;
  }
  pane-surface {
    display: flex;
    flex-direction: column;
    block-size: 100%;
    min-block-size: 0;
    overflow: hidden;
    background: var(--background-l1);
  }
  pane-surface[data-side='list'] {
    border-start-end-radius: var(--radius-3xl);
    border-end-end-radius: var(--radius-3xl);
  }
  pane-surface[data-side='detail'] {
    border-start-start-radius: var(--radius-3xl);
    border-end-start-radius: var(--radius-3xl);
  }
  .challenge-list {
    container-type: inline-size;
    container-name: archive-list;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-block-size: 0;
  }
  .list-controls {
    display: flex;
    gap: 0.35rem;
    padding: 0.85rem 1.25rem;
  }
  .search-control {
    flex: 1;
    min-inline-size: 0;
  }
  .list-scroll {
    flex: 1;
    min-block-size: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-block-end: var(--space-s);
  }
  .category-header {
    position: sticky;
    inset-block-start: 0;
    z-index: 2;
    background: var(--background-l1);
  }
  .category-header button {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    display: flex;
    align-items: center;
    gap: 0.65rem;
    inline-size: 100%;
    padding: 0.6rem 0.75rem;
    text-align: start;
    color: var(--category-foreground-l1);
    background: var(--category-background-l0);
    cursor: pointer;
  }
  .category-header button:focus-visible,
  .challenge-row:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: -2px;
  }
  .category-header :global(svg[data-slot]) {
    flex-shrink: 0;
  }
  .category-name {
    flex: 1;
    min-inline-size: 0;
  }
  .category-count {
    font-size: var(--step--1);
    font-variant-numeric: tabular-nums;
  }
  .category-header :global([data-slot='chevron']) {
    rotate: -90deg;
    transition: rotate 160ms;
  }
  .category-header [data-expanded] :global([data-slot='chevron']) {
    rotate: 0deg;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .challenge-row {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    min-block-size: 5.5rem;
    padding: 1rem 1.1rem 1rem 2.25rem;
    color: var(--category-foreground-l0);
    text-decoration: none;
  }
  .challenge-row:hover {
    background: var(--category-background-l1-hover);
  }
  .challenge-row[data-selected] {
    background: color-mix(
      in srgb,
      var(--category-background-l0) 52%,
      transparent
    );
    box-shadow:
      inset 3px 0 0 var(--category-foreground-l1),
      inset 0 0 0 1px
        color-mix(in srgb, var(--category-foreground-l1) 25%, transparent);
  }
  .challenge-row[data-solved] {
    --solved-color: var(--foreground-success);
  }
  .challenge-row :global([data-slot='solved']) {
    position: absolute;
    inset-inline-start: 0.65rem;
    color: var(--solved-color);
  }
  .challenge-copy,
  .challenge-meta {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-inline-size: 0;
  }
  .challenge-copy {
    flex: 1;
  }
  .challenge-name,
  .challenge-author {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .challenge-name {
    font-size: 1.2rem;
  }
  .challenge-author,
  .challenge-status {
    font-size: var(--step--1);
    color: var(--category-foreground-l1);
    opacity: 0.8;
  }
  .challenge-meta {
    flex-shrink: 0;
    align-items: flex-end;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .challenge-points {
    color: var(--category-foreground-l1);
  }
  .challenge-points strong {
    font-size: 1.2rem;
    font-weight: var(--font-weight-normal);
    color: var(--category-foreground-l0);
  }
  .reference-label {
    font-size: var(--step--2);
    color: var(--category-foreground-l1);
  }
  .detail-placeholder {
    position: relative;
    isolation: isolate;
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-m);
  }
  .workspace-status {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-s);
    padding: var(--space-l);
    text-align: center;
  }
  .workspace-status h1,
  .workspace-status h2 {
    white-space: normal;
    font-size: var(--step-2);
  }
  .workspace-status p {
    max-inline-size: 30rem;
    color: var(--foreground-l3);
  }
  .upcoming-state :global(svg) {
    inline-size: 2.5rem;
    block-size: 2.5rem;
    color: var(--foreground-l4);
  }
  .status-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-s);
  }
  .empty-action {
    display: flex;
    justify-content: center;
  }
  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  @container archive-list (width < 25rem) {
    .challenge-row {
      flex-wrap: wrap;
      gap: 0.35rem;
    }
    .challenge-copy {
      flex-basis: 100%;
    }
    .challenge-meta {
      flex-direction: row;
      align-items: baseline;
      gap: 0.5rem;
    }
  }
  @media (width < 768px) {
    .event-toolbar {
      flex-wrap: wrap;
      gap: 0.3rem 0.5rem;
      padding: 0.5rem 0.65rem;
    }
    .event-heading {
      flex: 1 1 calc(100% - 7rem);
    }
    .practice-label {
      display: none;
    }
    .toolbar-actions {
      flex-wrap: wrap;
      justify-content: space-between;
      inline-size: 100%;
      padding-inline-start: 0.6rem;
    }
    pane-surface[data-side] {
      border-radius: 0;
    }
    .list-controls {
      padding: 0.7rem 0.75rem;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .category-header :global([data-slot='chevron']) {
      transition: none;
    }
  }
</style>
