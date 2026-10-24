<script lang="ts">
  import {
    ArchiveClubEventRouteV2,
    CreateClubEventRouteV2,
    GoodClubEventArchive,
    GoodClubEventCreate,
    GoodClubEventUpdate,
    Permissions,
    UpdateClubEventRouteV2,
    type ClubEventSummary,
  } from '@rctf/types'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { apiRequest, isAuthenticated } from '$lib/api'
  import { archiveChallengeHref } from '$lib/club/archive-model'
  import {
    clubEventChallengeHref,
    clubEventPhase,
  } from '$lib/club/club-event-model'
  import {
    createPracticeSubmissionGuard,
    type PracticeRequest,
  } from '$lib/club/practice-submission'
  import { useAdminChallenges } from '$lib/query/admin'
  import {
    clubQueryKeys,
    useClubAccess,
    useClubArchive,
    useClubArchives,
  } from '$lib/query/club'
  import {
    clubEventQueryKeys,
    useClubEvent,
    useClubEvents,
  } from '$lib/query/club-events'
  import { queryKeys } from '$lib/query/keys'
  import { useCurrentUser } from '$lib/query/user'
  import Button from '$lib/ui/button.svelte'
  import Checkbox from '$lib/ui/checkbox.svelte'
  import Dialog from '$lib/ui/dialog.svelte'
  import SettingsField from '$lib/ui/field.svelte'
  import Input from '$lib/ui/input.svelte'
  import Spinner from '$lib/ui/spinner.svelte'
  import Textarea from '$lib/ui/textarea.svelte'
  import { hasPermissions } from '$lib/utils/permissions'
  import { onDestroy, onMount } from 'svelte'
  import { formatDatetimeLocal } from '../../settings/settings-model'
  import {
    buildEventMetadata,
    canCloseClubEvent,
    eventChallengeUnavailableReason,
    type EventForm,
  } from './events-model'

  const queryClient = useQueryClient()
  const access = useClubAccess()
  const user = useCurrentUser()
  const allowed = $derived(
    access.data?.canManageArchives === true &&
      !access.isError &&
      !!user.data &&
      !user.isError
  )
  const canReadBank = $derived(
    allowed && hasPermissions(user.data, Permissions.challsRead)
  )
  const events = useClubEvents(() => allowed)
  let selectedId = $state('')
  const selected = $derived(events.data?.find(event => event.id === selectedId))
  const creating = $derived(!selectedId)
  const detail = useClubEvent(
    () => selectedId,
    () => allowed && !creating
  )
  let now = $state(Date.now())
  let form = $state<EventForm>(emptyForm())
  let source = $state<'bank' | 'archive'>('bank')
  let sourceArchiveId = $state('')
  let chosenIds = $state<string[]>([])
  let challengeSearch = $state('')
  let eventSearch = $state('')
  let saving = $state(false)
  let error = $state('')
  let notice = $state('')
  let action = $state<{
    kind: 'close' | 'archive'
    event: ClubEventSummary
  } | null>(null)
  const bank = useAdminChallenges(
    () => canReadBank && creating && source === 'bank'
  )
  const archives = useClubArchives(
    () => allowed && creating && source === 'archive'
  )
  const archive = useClubArchive(
    () => sourceArchiveId,
    () => allowed && creating && source === 'archive' && !!sourceArchiveId
  )
  const sourceOptions = $derived(
    source === 'bank'
      ? (canReadBank && !bank.isError ? (bank.data ?? []) : []).map(
          challenge => ({
            id: challenge.id,
            name: challenge.name,
            category: challenge.category,
            points: challenge.points.max,
            reason: eventChallengeUnavailableReason(challenge),
          })
        )
      : (!archive.isError ? (archive.data?.challenges ?? []) : []).map(
          challenge => ({
            id: challenge.id,
            name: challenge.name,
            category: challenge.category,
            points: challenge.points,
            reason: challenge.practiceAvailable
              ? null
              : (challenge.practiceUnavailableReason ??
                'Unavailable for event submissions.'),
          })
        )
  )
  const eligible = $derived(
    sourceOptions.filter(challenge => !challenge.reason)
  )
  const visibleChallenges = $derived(
    sourceOptions.filter(challenge =>
      `${challenge.name} ${challenge.category}`
        .toLowerCase()
        .includes(challengeSearch.toLowerCase())
    )
  )
  const visibleEvents = $derived(
    (events.data ?? []).filter(event =>
      `${event.name} ${event.description}`
        .toLowerCase()
        .includes(eventSearch.toLowerCase())
    )
  )
  const frozen = $derived(!!selected?.archiveId)
  const startLocked = $derived(!!selected && now >= selected.startTime)
  const dateTime = (timestamp: number) =>
    new Date(timestamp).toLocaleString('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })

  const requests = createPracticeSubmissionGuard(() => {
    const currentUser = queryClient.getQueryState<{ id: string } | null>(
      queryKeys.userSelf
    )
    const currentAccess = queryClient.getQueryState<{
      canManageArchives: boolean
    }>(clubQueryKeys.access)
    return {
      mode: 'event',
      archiveId: 'admin-club-events',
      challengeId: 'manage',
      userId:
        currentUser?.status === 'success'
          ? (currentUser.data?.id ?? null)
          : null,
      allowed:
        isAuthenticated() &&
        currentAccess?.status === 'success' &&
        currentAccess.data?.canManageArchives === true,
    }
  })
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 1000)
    const unsubscribe = queryClient
      .getQueryCache()
      .subscribe(() => requests.refresh())
    return () => {
      clearInterval(timer)
      unsubscribe()
    }
  })
  onDestroy(() => requests.dispose())
  $effect(() => {
    if (!canReadBank && source === 'bank') {
      source = 'archive'
      chosenIds = []
    }
    if (!allowed) {
      action = null
      saving = false
      error = ''
      notice = ''
    }
  })

  function emptyForm(): EventForm {
    const start = Date.now() + 3_600_000
    return {
      name: '',
      description: '',
      start: formatDatetimeLocal(start),
      end: formatDatetimeLocal(start + 7_200_000),
      published: false,
    }
  }
  function edit(event: ClubEventSummary) {
    if (saving) return
    selectedId = event.id
    form = {
      name: event.name,
      description: event.description,
      start: formatDatetimeLocal(event.startTime),
      end: formatDatetimeLocal(event.endTime),
      published: event.published,
    }
    error = ''
    notice = ''
    action = null
  }
  function createNew() {
    if (saving) return
    selectedId = ''
    form = emptyForm()
    chosenIds = []
    challengeSearch = ''
    error = ''
    notice = ''
    action = null
  }
  function setSource(value: 'bank' | 'archive') {
    source = value
    chosenIds = []
    challengeSearch = ''
  }
  function selectArchive(id: string) {
    sourceArchiveId = id
    chosenIds = []
    const summary = archives.data?.find(item => item.id === id)
    if (summary && !form.name) form.name = summary.name
    if (summary && !form.description) form.description = summary.description
  }
  function toggleChallenge(id: string, checked: boolean) {
    chosenIds = checked
      ? [...new Set([...chosenIds, id])]
      : chosenIds.filter(value => value !== id)
  }
  function reportFailure(response: { kind: string; message: string }) {
    error = response.message
    if (response.kind === 'badPerms' || response.kind === 'badToken')
      void access.refetch()
  }
  async function refreshEvent(id: string, includeArchives = false) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: clubEventQueryKeys.events,
        exact: true,
      }),
      queryClient.invalidateQueries({
        queryKey: clubEventQueryKeys.event(id),
        exact: true,
      }),
      ...(includeArchives
        ? [
            queryClient.invalidateQueries({
              queryKey: clubQueryKeys.archives,
              exact: true,
            }),
          ]
        : []),
    ])
  }
  async function mutate(
    operation: (request: PracticeRequest) => Promise<void>
  ) {
    if (saving || !allowed) return
    const request = requests.capture()
    if (!request) return
    saving = true
    error = ''
    notice = ''
    try {
      await operation(request)
    } catch {
      if (requests.isCurrent(request))
        error = 'The event could not be saved. Please try again.'
    } finally {
      if (requests.isCurrent(request)) saving = false
    }
  }
  async function save(event: SubmitEvent) {
    event.preventDefault()
    const current = selected
    if (!creating && !current) {
      error = 'Reload the event list before saving this event.'
      return
    }
    const result = buildEventMetadata(form, Date.now(), current)
    if (!result.data) {
      error = result.error
      return
    }
    const metadata = result.data
    const ids = [...chosenIds]
    if (
      creating &&
      (!ids.length ||
        ids.length > 1000 ||
        ids.some(id => !eligible.some(challenge => challenge.id === id)) ||
        (source === 'bank' && !canReadBank) ||
        (source === 'archive' &&
          (!sourceArchiveId || archive.isPending || archive.isError)))
    ) {
      error =
        'Select between 1 and 1,000 available challenges from the chosen source.'
      return
    }
    const sourceId = source === 'archive' ? sourceArchiveId : undefined
    await mutate(async request => {
      const response = current
        ? await apiRequest(UpdateClubEventRouteV2, {
            id: current.id,
            ...metadata,
          })
        : await apiRequest(CreateClubEventRouteV2, {
            ...metadata,
            challengeIds: ids,
            sourceArchiveId: sourceId,
          })
      if (!requests.isCurrent(request)) return
      if (
        response.kind !== GoodClubEventCreate.kind &&
        response.kind !== GoodClubEventUpdate.kind
      ) {
        reportFailure(response)
        return
      }
      selectedId = response.data.id
      form = {
        name: response.data.name,
        description: response.data.description,
        start: formatDatetimeLocal(response.data.startTime),
        end: formatDatetimeLocal(response.data.endTime),
        published: response.data.published,
      }
      notice = current
        ? 'Event changes saved.'
        : 'Event created. Its challenge selection is now fixed.'
      await refreshEvent(response.data.id)
    })
  }
  async function confirmAction() {
    const target = action
    if (!target) return
    await mutate(async request => {
      if (target.kind === 'close') {
        const endTime = Date.now()
        if (!canCloseClubEvent(target.event, endTime)) {
          error = 'Only an event within its schedule can be closed now.'
          return
        }
        const response = await apiRequest(UpdateClubEventRouteV2, {
          id: target.event.id,
          endTime,
        })
        if (!requests.isCurrent(request)) return
        if (response.kind !== GoodClubEventUpdate.kind) {
          reportFailure(response)
          return
        }
        if (selectedId === target.event.id)
          form.end = formatDatetimeLocal(response.data.endTime)
        notice = 'Event closed. Its scores are ready to archive.'
        action = null
        await refreshEvent(target.event.id)
      } else {
        if (Date.now() < target.event.endTime) {
          error = 'Wait until the event ends before archiving it.'
          return
        }
        const response = await apiRequest(ArchiveClubEventRouteV2, {
          id: target.event.id,
        })
        if (!requests.isCurrent(request)) return
        if (response.kind !== GoodClubEventArchive.kind) {
          reportFailure(response)
          return
        }
        notice =
          'Event archived. Members can practice its challenges from the archive.'
        action = null
        await refreshEvent(target.event.id, true)
      }
    })
  }
</script>

<svelte:head><title>Club events | Admin</title></svelte:head>

<section class="event-admin" aria-label="Manage club events">
  {#if access.isPending || user.isPending}
    <div class="status" role="status">
      <Spinner />
      <p>Checking event-management access…</p>
    </div>
  {:else if access.isError}
    <div class="status">
      <p>{access.error.message}</p>
      <Button onclick={() => access.refetch()}>Retry</Button>
    </div>
  {:else if !allowed}
    <div class="status">
      <p>Event-settings permission is required to manage club events.</p>
    </div>
  {:else if events.isPending}
    <div class="status" role="status">
      <Spinner />
      <p>Loading club events…</p>
    </div>
  {:else if events.isError}
    <div class="status">
      <p>{events.error.message}</p>
      <Button onclick={() => events.refetch()}>Retry</Button>
    </div>
  {:else}
    <aside aria-label="Club events">
      <div class="list-toolbar">
        <h1>Club events</h1>
        <Button size="sm" onclick={createNew} disabled={saving}
          >New event</Button
        >
      </div>
      <div class="list-search">
        <Input
          bind:value={eventSearch}
          aria-label="Find an event"
          placeholder="Find an event…"
        />
      </div>
      <div class="event-list">
        {#each visibleEvents as event (event.id)}
          <button
            class="event-row"
            class:selected={selectedId === event.id}
            disabled={saving}
            onclick={() => edit(event)}
            aria-pressed={selectedId === event.id}
          >
            <span class="event-title">{event.name}</span><span class="phase"
              >{event.archiveId ? 'Archived' : clubEventPhase(event, now)}</span
            >
            <span class="event-summary"
              >{event.challengeCount} challenges · {event.participantCount} participants</span
            >
            <span class="event-date">{dateTime(event.startTime)}</span>
          </button>
        {:else}<p class="empty">
            {events.data?.length
              ? 'No matching events.'
              : 'No club events yet. Create an event from existing challenges.'}
          </p>{/each}
      </div>
    </aside>
    <div class="editor">
      <header class="editor-heading">
        <div>
          <h2>
            {creating ? 'New club event' : (selected?.name ?? 'Club event')}
          </h2>
          <p>
            {creating
              ? 'Choose existing challenges and a schedule for Members.'
              : `${selected?.challengeCount ?? 0} fixed challenges · Members only`}
          </p>
        </div>
        {#if selected}<Button
            href={clubEventChallengeHref(selected.id)}
            variant="ghost"
            size="sm">Preview ↗</Button
          >{/if}
      </header>
      <form class="event-form" onsubmit={save}>
        <div class="editor-scroll">
          {#if notice}<p class="notice" role="status">{notice}</p>{/if}
          {#if error && !action}<p class="error" role="alert">{error}</p>{/if}
          {#if frozen}<p class="notice">
              This event is archived and cannot be changed. <a
                href={archiveChallengeHref(selected!.archiveId!)}
                >Open archive ↗</a
              >
            </p>{/if}
          <fieldset disabled={saving || frozen}>
            <SettingsField label="Event name" required
              >{#snippet children({ id, describedBy })}<Input
                  {id}
                  aria-describedby={describedBy}
                  bind:value={form.name}
                  maxlength={200}
                  required
                />{/snippet}</SettingsField
            >
            <SettingsField
              label="Description"
              description="Markdown is supported."
              >{#snippet children({ id, describedBy })}<Textarea
                  {id}
                  aria-describedby={describedBy}
                  bind:value={form.description}
                  maxlength={5000}
                  rows={3}
                />{/snippet}</SettingsField
            >
            <div class="timing-grid">
              <SettingsField
                label="Start (local time)"
                description={startLocked
                  ? 'The start time is fixed after the event begins.'
                  : undefined}
                required
                >{#snippet children({ id, describedBy })}<Input
                    {id}
                    aria-describedby={describedBy}
                    type="datetime-local"
                    bind:value={form.start}
                    disabled={startLocked}
                    required
                  />{/snippet}</SettingsField
              >
              <SettingsField label="End (local time)" required
                >{#snippet children({ id, describedBy })}<Input
                    {id}
                    aria-describedby={describedBy}
                    type="datetime-local"
                    bind:value={form.end}
                    required
                  />{/snippet}</SettingsField
              >
            </div>
            <div class="publish-field">
              <Checkbox bind:checked={form.published}
                >Publish to Members</Checkbox
              >
              <p>
                Drafts stay visible to event administrators. Published events
                accept submissions only within their schedule.
              </p>
            </div>
          </fieldset>
          {#if creating}
            <div class="source-controls">
              <SettingsField label="Challenge source"
                >{#snippet children({ id })}<select
                    {id}
                    value={source}
                    disabled={saving}
                    onchange={event =>
                      setSource(
                        event.currentTarget.value as 'bank' | 'archive'
                      )}
                    ><option value="bank" disabled={!canReadBank}
                      >Challenge bank{!canReadBank
                        ? ' (read permission required)'
                        : ''}</option
                    ><option value="archive">Existing archive</option></select
                  >{/snippet}</SettingsField
              >
              {#if source === 'archive'}<SettingsField label="Archive"
                  >{#snippet children({ id })}<select
                      {id}
                      value={sourceArchiveId}
                      disabled={saving ||
                        archives.isPending ||
                        archives.isError}
                      onchange={event =>
                        selectArchive(event.currentTarget.value)}
                      ><option value="">Choose an archive…</option
                      >{#each archives.data ?? [] as item (item.id)}<option
                          value={item.id}>{item.name}</option
                        >{/each}</select
                    >{/snippet}</SettingsField
                >{/if}
            </div>
            {#if source === 'archive' && archives.isError}<div
                class="source-status"
              >
                <p>{archives.error.message}</p>
                <Button size="sm" onclick={() => archives.refetch()}
                  >Retry archive list</Button
                >
              </div>
            {:else if source === 'archive' && archives.isPending}<p
                class="empty"
                role="status"
              >
                Loading archives…
              </p>
            {:else if source === 'archive' && !archives.data?.length}<p
                class="empty"
              >
                No archives are available.
              </p>
            {:else if source === 'archive' && !sourceArchiveId}<p class="empty">
                Choose an archive to select its supported challenges.
              </p>
            {:else if (source === 'bank' && bank.isPending) || (source === 'archive' && archive.isPending)}<p
                class="empty"
                role="status"
              >
                Loading challenges…
              </p>
            {:else if (source === 'bank' && bank.isError) || (source === 'archive' && archive.isError)}<div
                class="source-status"
              >
                <p>
                  {source === 'bank'
                    ? bank.error?.message
                    : archive.error?.message}
                </p>
                <Button
                  size="sm"
                  onclick={() =>
                    source === 'bank' ? bank.refetch() : archive.refetch()}
                  >Retry challenges</Button
                >
              </div>
            {:else}
              <div class="challenge-toolbar">
                <Input
                  bind:value={challengeSearch}
                  aria-label="Find a challenge"
                  placeholder="Find a challenge…"
                /><span>{chosenIds.length} selected</span><Button
                  size="sm"
                  variant="ghost"
                  disabled={saving ||
                    !eligible.length ||
                    eligible.length > 1000}
                  onclick={() =>
                    (chosenIds = eligible.map(challenge => challenge.id))}
                  >Select all</Button
                ><Button
                  size="sm"
                  variant="ghost"
                  disabled={saving || !chosenIds.length}
                  onclick={() => (chosenIds = [])}>Clear</Button
                >
              </div>
              <div class="challenge-list">
                {#each visibleChallenges as challenge (challenge.id)}<div
                    class="challenge-row"
                  >
                    <Checkbox
                      checked={chosenIds.includes(challenge.id)}
                      disabled={saving || !!challenge.reason}
                      onchange={event =>
                        toggleChallenge(
                          challenge.id,
                          event.currentTarget.checked
                        )}
                      ><span
                        ><strong>{challenge.name}</strong><small
                          >{challenge.category}{#if challenge.reason}
                            · {challenge.reason}{/if}</small
                        ></span
                      ></Checkbox
                    ><span class="points">{challenge.points} pts</span>
                  </div>{:else}<p class="empty">
                    No matching challenges.
                  </p>{/each}
              </div>
              <p class="hint">
                The selected challenges and their points are copied when the
                event is created. Live instances, admin bots and unsupported
                flags cannot be used.
              </p>
            {/if}
          {:else}
            <div class="fixed-challenges">
              <h3>Event challenges</h3>
              <p class="hint">
                The challenge selection and points were fixed when this event
                was created.
              </p>
              {#if detail.isPending}<p class="empty" role="status">
                  Loading challenges…
                </p>{:else if detail.isError}<div class="source-status">
                  <p>{detail.error.message}</p>
                  <Button size="sm" onclick={() => detail.refetch()}
                    >Retry</Button
                  >
                </div>{:else}{#each detail.data?.challenges ?? [] as challenge (challenge.id)}<div
                    class="challenge-row"
                  >
                    <span
                      ><strong>{challenge.name}</strong><small
                        >{challenge.category}</small
                      ></span
                    ><span class="points">{challenge.points} pts</span>
                  </div>{/each}{/if}
            </div>
          {/if}
        </div>
        <footer>
          <div class="lifecycle-actions">
            {#if selected && !frozen}<Button
                variant="outline"
                size="sm"
                disabled={saving || !canCloseClubEvent(selected, now)}
                onclick={() => {
                  error = ''
                  action = { kind: 'close', event: selected! }
                }}>Close event</Button
              ><Button
                variant="outline"
                size="sm"
                disabled={saving || now < selected.endTime}
                onclick={() => {
                  error = ''
                  action = { kind: 'archive', event: selected! }
                }}>Archive event</Button
              >{/if}
          </div>
          {#if !frozen}<Button
              type="submit"
              disabled={saving || (creating && !chosenIds.length)}
              >{saving
                ? 'Saving…'
                : creating
                  ? 'Create event'
                  : 'Save changes'}</Button
            >{/if}
        </footer>
      </form>
    </div>
  {/if}
</section>

<Dialog
  open={!!action && allowed}
  onOpenChange={open => {
    if (!open && !saving) action = null
  }}
  title={action?.kind === 'close' ? 'Close event' : 'Archive event'}
  description={action?.kind === 'close'
    ? 'End submissions now and keep the current event scores.'
    : 'Freeze this ended event and make its challenges available for Member practice.'}
>
  {#snippet children()}
    {#if action}<p class="dialog-name">{action.event.name}</p>{/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="dialog-actions">
      <Button variant="ghost" disabled={saving} onclick={() => (action = null)}
        >Cancel</Button
      ><Button disabled={saving} onclick={confirmAction}
        >{saving
          ? 'Saving…'
          : action?.kind === 'close'
            ? 'Close event'
            : 'Archive event'}</Button
      >
    </div>
  {/snippet}
</Dialog>

<style>
  .event-admin {
    display: grid;
    grid-template-columns: minmax(16rem, 28%) minmax(0, 1fr);
    inline-size: 100%;
    flex: 1;
    min-block-size: 0;
    block-size: calc(100dvh - var(--header-height));
    overflow: hidden;
  }
  aside,
  .editor,
  .event-form {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    min-block-size: 0;
  }
  aside {
    border-inline-end: 1px solid var(--border);
    background: var(--background-l1);
  }
  .list-toolbar,
  .editor-heading,
  .challenge-toolbar,
  footer,
  .dialog-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .list-toolbar,
  .editor-heading {
    flex-shrink: 0;
    padding: 1rem 1.25rem;
    border-block-end: 1px solid var(--border);
  }
  h1,
  h2 {
    font-size: 1rem;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .editor-heading div {
    min-inline-size: 0;
  }
  .editor-heading p,
  .hint,
  .publish-field p {
    margin-block-start: 0.35rem;
    color: var(--foreground-l3);
    font-size: 0.75rem;
    line-height: 1.6;
  }
  .list-search {
    padding: 0.75rem;
  }
  .event-list {
    overflow-y: auto;
    flex: 1;
    min-block-size: 0;
  }
  .event-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.35rem 0.5rem;
    inline-size: 100%;
    padding: 1rem;
    border-block-end: 1px solid var(--border);
    border-inline-start: 3px solid transparent;
    text-align: start;
    cursor: pointer;
  }
  .event-row:hover {
    background: var(--background-l2);
  }
  .event-row.selected {
    background: var(--club-accent-soft);
    border-inline-start-color: var(--club-accent-text);
  }
  .event-row:disabled {
    cursor: wait;
    opacity: 0.7;
  }
  .event-title {
    color: var(--foreground-l0);
    font-size: 0.85rem;
    overflow-wrap: anywhere;
  }
  .phase {
    color: var(--club-accent-text);
    font-family: var(--font-mono);
    font-size: 0.65rem;
    text-transform: capitalize;
  }
  .event-summary,
  .event-date {
    grid-column: 1/-1;
    color: var(--foreground-l3);
    font-size: 0.7rem;
  }
  .event-form {
    flex: 1;
  }
  .editor-scroll {
    flex: 1;
    min-block-size: 0;
    overflow-y: auto;
    padding: 1.25rem;
  }
  fieldset {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    border: none;
  }
  fieldset:disabled {
    opacity: 0.7;
  }
  .timing-grid,
  .source-controls {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }
  .source-controls {
    margin-block: 1.5rem 1rem;
  }
  select {
    inline-size: 100%;
    min-inline-size: 0;
    block-size: 2.25rem;
    padding-inline: 0.5rem;
    color: var(--foreground-l0);
    background: var(--background-l4);
    border: 2px solid transparent;
    border-radius: var(--radius-md);
  }
  select:focus-visible {
    outline: 2px solid var(--ring);
  }
  .challenge-toolbar {
    flex-wrap: wrap;
    margin-block-end: 0.65rem;
  }
  .challenge-toolbar :global(input) {
    flex: 1;
    min-inline-size: 9rem;
  }
  .challenge-toolbar > span {
    color: var(--foreground-l3);
    font-size: 0.75rem;
    white-space: nowrap;
  }
  .challenge-list {
    max-block-size: 25rem;
    overflow-y: auto;
    border-block: 1px solid var(--border);
  }
  .challenge-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.65rem 0.25rem;
    border-block-end: 1px solid var(--border);
  }
  .challenge-row :global(label) {
    min-inline-size: 0;
    flex: 1;
  }
  .challenge-row strong {
    display: block;
    color: var(--foreground-l1);
    font-size: 0.8rem;
    font-weight: 500;
    overflow-wrap: anywhere;
  }
  .challenge-row small {
    display: block;
    color: var(--foreground-l3);
    font-size: 0.7rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
  .points {
    flex-shrink: 0;
    color: var(--foreground-l3);
    font-family: var(--font-mono);
    font-size: 0.7rem;
  }
  .fixed-challenges {
    margin-block-start: 1.5rem;
  }
  h3 {
    font-size: 0.85rem;
    font-weight: 500;
  }
  footer {
    flex-shrink: 0;
    padding: 0.85rem 1.25rem;
    border-block-start: 1px solid var(--border);
    background: var(--background-l1);
  }
  .lifecycle-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .notice,
  .error {
    margin-block-end: 1rem;
    font-size: 0.8rem;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }
  .notice {
    color: var(--club-accent-text);
  }
  .error {
    color: var(--foreground-destructive);
  }
  .empty {
    padding: 1rem 0.5rem;
    color: var(--foreground-l3);
    font-size: 0.8rem;
    line-height: 1.6;
  }
  .status {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    grid-column: 1/-1;
    gap: 1rem;
    padding: 1.5rem;
    color: var(--foreground-l3);
  }
  .source-status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    padding-block: 1rem;
    color: var(--foreground-destructive);
    font-size: 0.8rem;
  }
  .dialog-actions {
    justify-content: flex-end;
    margin-block-start: 0.5rem;
  }
  .dialog-name {
    overflow-wrap: anywhere;
  }
  @media (width < 60rem) {
    .event-admin {
      grid-template-columns: minmax(13rem, 30%) minmax(0, 1fr);
    }
    .timing-grid,
    .source-controls {
      grid-template-columns: minmax(0, 1fr);
    }
    footer {
      flex-wrap: wrap;
    }
  }
  @media (width < 40rem) {
    .event-admin {
      display: flex;
      flex-direction: column;
      block-size: auto;
      overflow: visible;
    }
    aside {
      border-inline-end: none;
      border-block-end: 1px solid var(--border);
    }
    .event-list {
      max-block-size: 15rem;
    }
    .editor-scroll {
      overflow: visible;
      padding: 1rem;
    }
    .editor-heading {
      padding: 1rem;
    }
    footer {
      padding: 0.75rem 1rem;
    }
  }
</style>
