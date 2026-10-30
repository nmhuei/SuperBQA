<script lang="ts">
  import {
    AddClubEventChallengesRouteV2,
    CreateClubEventRouteV2,
    DeleteClubEventChallengeRouteV2,
    DeleteClubEventSolveRouteV2,
    GoodClubEventChallengesAdd,
    GoodClubEventChallengeDelete,
    GoodClubEventCreate,
    GoodClubEventSolveDelete,
    GoodClubEventUpdate,
    Permissions,
    UpdateClubEventRouteV2,
    type ClubEventSummary,
  } from '@rctf/types'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { goto } from '$app/navigation'
  import { apiRequest, isAuthenticated } from '$lib/api'
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
  } from '$lib/query/club'
  import {
    clubEventQueryKeys,
    useClubEvent,
    useClubEvents,
    useClubEventSubmissions,
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
  import {
    buildEventMetadata,
    canCloseClubEvent,
    eventChallengeUnavailableReason,
    formatDatetimeLocal,
    type EventForm,
  } from '$lib/club/events-admin-model'

  let {
    initialEventId = '',
    isCreateMode = false,
    onBack,
  }: {
    initialEventId?: string
    isCreateMode?: boolean
    onBack?: () => void
  } = $props()

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
  let activeTab = $state<'settings' | 'challenges' | 'submissions'>('settings')

  const submissionsQuery = useClubEventSubmissions(
    () => selectedId,
    () => allowed && !creating && !!selectedId
  )

  // In-event challenge management
  let isAddingChallenges = $state(false)
  let addingChallengeIds = $state<string[]>([])
  let addChallengeSearch = $state('')
  let challengeSearchInEvent = $state('')
  let challengeToDelete = $state<string | null>(null)

  // In-event submissions management
  let subSearch = $state('')
  let subChallengeFilter = $state('all')
  let subResultFilter = $state<
    'all' | 'correct' | 'incorrect' | 'alreadySolved'
  >('all')
  let solveToDelete = $state<string | null>(null)

  let now = $state(Date.now())
  let form = $state<EventForm>(emptyForm())
  let chosenIds = $state<string[]>([])
  let challengeSearch = $state('')
  let saving = $state(false)
  let saveSuccess = $state(false)
  let saveSuccessTimeout: ReturnType<typeof setTimeout> | null = null
  let toast = $state<{ message: string; id: number } | null>(null)
  let toastTimeout: ReturnType<typeof setTimeout> | null = null
  let error = $state('')
  let notice = $state('')
  let action = $state<{
    kind: 'close'
    event: ClubEventSummary
  } | null>(null)

  function showToast(message: string) {
    if (toastTimeout) clearTimeout(toastTimeout)
    toast = { message, id: Date.now() }
    toastTimeout = setTimeout(() => {
      toast = null
    }, 20000)
  }

  function dismissToast() {
    if (toastTimeout) clearTimeout(toastTimeout)
    toast = null
  }

  const bank = useAdminChallenges(
    () => canReadBank && (creating || isAddingChallenges || activeTab === 'challenges')
  )
  const sourceOptions = $derived(
    (canReadBank && !bank.isError ? (bank.data ?? []) : []).map(challenge => ({
      id: challenge.id,
      name: challenge.name,
      category: challenge.category,
      points: challenge.points.max,
      reason: eventChallengeUnavailableReason(challenge),
    }))
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
  const startLocked = $derived(!!selected && now >= selected.startTime)

  const eventChallenges = $derived(detail.data?.challenges ?? [])
  const eventChallengesFiltered = $derived(
    eventChallenges.filter(c =>
      `${c.name} ${c.category}`
        .toLowerCase()
        .includes(challengeSearchInEvent.toLowerCase())
    )
  )
  const totalEventPoints = $derived(
    eventChallenges.reduce((sum, c) => sum + (c.points ?? 0), 0)
  )
  const totalEventSolves = $derived(
    eventChallenges.reduce((sum, c) => sum + (c.solves ?? 0), 0)
  )

  const candidateBankChallenges = $derived(
    (bank.data ?? [])
      .filter(b => !eventChallenges.some(c => c.id === b.id))
      .filter(b =>
        `${b.name} ${b.category}`
          .toLowerCase()
          .includes(addChallengeSearch.toLowerCase())
      )
  )

  const submissionsList = $derived(submissionsQuery.data ?? [])
  const filteredSubmissions = $derived(
    submissionsList.filter(sub => {
      if (subChallengeFilter !== 'all' && sub.challengeId !== subChallengeFilter)
        return false
      if (subResultFilter !== 'all') {
        if (subResultFilter === 'correct' && sub.result !== 'correct')
          return false
        if (subResultFilter === 'incorrect' && sub.result !== 'incorrect')
          return false
        if (
          subResultFilter === 'alreadySolved' &&
          sub.result !== 'alreadySolved'
        )
          return false
      }
      if (subSearch.trim()) {
        const query = subSearch.toLowerCase()
        const textToSearch = `${sub.userName} ${sub.challengeName} ${sub.submittedFlag ?? ''} ${sub.result}`.toLowerCase()
        if (!textToSearch.includes(query)) return false
      }
      return true
    })
  )

  function toggleAddChallenge(id: string, checked: boolean) {
    addingChallengeIds = checked
      ? [...new Set([...addingChallengeIds, id])]
      : addingChallengeIds.filter(v => v !== id)
  }

  function handleBack() {
    if (onBack) {
      onBack()
    } else {
      void goto('/club/events')
    }
  }

  let syncEventId = $state('')
  $effect(() => {
    if (selected && selected.id !== syncEventId && !creating) {
      syncEventId = selected.id
      form = {
        name: selected.name,
        description: selected.description,
        start: formatDatetimeLocal(selected.startTime),
        end: formatDatetimeLocal(selected.endTime),
        published: selected.published,
        clubOnly: selected.clubOnly ?? false,
      }
    }
  })

  $effect(() => {
    if (initialEventId && initialEventId !== selectedId && !isCreateMode) {
      selectedId = initialEventId
      syncEventId = ''
    } else if (isCreateMode && selectedId !== '') {
      createNew()
    } else if (!selectedId && !isCreateMode && events.data && events.data.length > 0) {
      const first = events.data[0]
      if (first) {
        selectedId = first.id
        syncEventId = ''
      }
    }
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

  onDestroy(() => {
    requests.dispose()
    if (saveSuccessTimeout) clearTimeout(saveSuccessTimeout)
    if (toastTimeout) clearTimeout(toastTimeout)
  })

  $effect(() => {
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
      published: true,
      clubOnly: false,
    }
  }

  function edit(event: ClubEventSummary) {
    if (saving) return
    selectedId = event.id
    syncEventId = event.id
    form = {
      name: event.name,
      description: event.description,
      start: formatDatetimeLocal(event.startTime),
      end: formatDatetimeLocal(event.endTime),
      published: event.published,
      clubOnly: event.clubOnly ?? false,
    }
    error = ''
    notice = ''
    action = null
    saveSuccess = false
    if (saveSuccessTimeout) clearTimeout(saveSuccessTimeout)
    isAddingChallenges = false
    addingChallengeIds = []
    addChallengeSearch = ''
    challengeToDelete = null
    solveToDelete = null
  }

  function createNew() {
    if (saving) return
    selectedId = ''
    syncEventId = ''
    activeTab = 'settings'
    form = emptyForm()
    chosenIds = []
    challengeSearch = ''
    error = ''
    notice = ''
    action = null
    saveSuccess = false
    if (saveSuccessTimeout) clearTimeout(saveSuccessTimeout)
    isAddingChallenges = false
    addingChallengeIds = []
    addChallengeSearch = ''
    challengeToDelete = null
    solveToDelete = null
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

  async function refreshEvent(id: string) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: clubEventQueryKeys.events,
        exact: true,
      }),
      queryClient.invalidateQueries({
        queryKey: clubEventQueryKeys.event(id),
        exact: true,
      }),
      queryClient.invalidateQueries({
        queryKey: clubEventQueryKeys.submissions(id),
        exact: true,
      }),
    ])
  }

  async function addChallengesToEvent() {
    if (!selectedId || !addingChallengeIds.length) return
    await mutate(async request => {
      const response = await apiRequest(AddClubEventChallengesRouteV2, {
        id: selectedId,
        challengeIds: addingChallengeIds,
      })
      if (!requests.isCurrent(request)) return
      if (response.kind !== GoodClubEventChallengesAdd.kind) {
        reportFailure(response)
        return
      }
      notice = `Added ${response.data.added} challenge(s) to event.`
      showToast(`Added ${response.data.added} challenge(s) to event.`)
      isAddingChallenges = false
      addingChallengeIds = []
      addChallengeSearch = ''
      await refreshEvent(selectedId)
    })
  }

  async function removeChallengeFromEvent(challengeId: string) {
    if (!selectedId) return
    await mutate(async request => {
      const response = await apiRequest(DeleteClubEventChallengeRouteV2, {
        id: selectedId,
        challengeId,
      })
      if (!requests.isCurrent(request)) return
      if (response.kind !== GoodClubEventChallengeDelete.kind) {
        reportFailure(response)
        return
      }
      notice = 'Challenge removed from event.'
      showToast('Challenge removed from event.')
      challengeToDelete = null
      await refreshEvent(selectedId)
    })
  }

  async function revokeSolve(solveId: string) {
    if (!selectedId) return
    await mutate(async request => {
      const response = await apiRequest(DeleteClubEventSolveRouteV2, {
        id: selectedId,
        solveId,
      })
      if (!requests.isCurrent(request)) return
      if (response.kind !== GoodClubEventSolveDelete.kind) {
        reportFailure(response)
        return
      }
      notice = 'Solve revoked successfully.'
      showToast('Solve revoked successfully.')
      solveToDelete = null
      await refreshEvent(selectedId)
    })
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
        !canReadBank)
    ) {
      error =
        'Select between 1 and 1,000 available challenges from the challenge bank.'
      return
    }
    await mutate(async request => {
      const response = current
        ? await apiRequest(UpdateClubEventRouteV2, {
            id: current.id,
            ...metadata,
          })
        : await apiRequest(CreateClubEventRouteV2, {
            ...metadata,
            challengeIds: ids,
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
      syncEventId = response.data.id
      form = {
        name: response.data.name,
        description: response.data.description,
        start: formatDatetimeLocal(response.data.startTime),
        end: formatDatetimeLocal(response.data.endTime),
        published: response.data.published,
        clubOnly: response.data.clubOnly,
      }
      notice = current
        ? 'Event changes saved successfully.'
        : 'Event created successfully. Its challenge selection is now fixed.'
      showToast('Event changes saved successfully.')
      saveSuccess = true
      if (saveSuccessTimeout) clearTimeout(saveSuccessTimeout)
      saveSuccessTimeout = setTimeout(() => {
        saveSuccess = false
      }, 15000)
      await refreshEvent(response.data.id)
    })
  }

  async function confirmAction() {
    const target = action
    if (!target) return
    await mutate(async request => {
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
      notice = 'Event closed successfully.'
      showToast('Event closed successfully.')
      action = null
      await refreshEvent(target.event.id)
    })
  }
</script>

<svelte:head><title>Manage Club Events | Admin</title></svelte:head>

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
      <p>Event management permission is required.</p>
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
  {:else if !creating && !selected}
    <div class="status">
      <p>No club event selected.</p>
      <Button onclick={handleBack}>← Back to events</Button>
    </div>
  {:else}
    <div class="editor">
      <header class="editor-heading">
        <div class="heading-left">
          <Button
            variant="ghost"
            size="sm"
            class="back-btn"
            onclick={handleBack}
          >
            ← Back to events
          </Button>
          <div class="heading-meta">
            <h2>
              {creating ? 'New club event' : (selected?.name ?? 'Club event')}
            </h2>
            <p>
              {creating
                ? 'Choose existing challenges and a schedule for Members.'
                : `${eventChallenges.length} challenges · ${selected?.participantCount ?? 0} participants`}
            </p>
          </div>
        </div>
        <div class="header-actions">
          {#if selected}
            <Button
              href={clubEventChallengeHref(selected.id)}
              variant="ghost"
              size="sm">Preview ↗</Button
            >
          {/if}
        </div>
      </header>

      {#if !creating && selected}
        <nav class="editor-tabs" aria-label="Event tabs">
          <button
            type="button"
            class="tab-btn"
            class:active={activeTab === 'settings'}
            onclick={() => (activeTab = 'settings')}
          >
            Event Settings
          </button>
          <button
            type="button"
            class="tab-btn"
            class:active={activeTab === 'challenges'}
            onclick={() => (activeTab = 'challenges')}
          >
            Challenges ({eventChallenges.length})
          </button>
          <button
            type="button"
            class="tab-btn"
            class:active={activeTab === 'submissions'}
            onclick={() => (activeTab = 'submissions')}
          >
            Submissions ({submissionsList.length})
          </button>
        </nav>
      {/if}

      {#if creating || activeTab === 'settings'}
        <form class="event-form" onsubmit={save}>
          <div class="editor-scroll">
            {#if notice}<p class="notice" role="status">{notice}</p>{/if}
            {#if error && !action}<p class="error" role="alert">{error}</p>{/if}
            <fieldset disabled={saving}>
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
                  >Publish event</Checkbox
                >
                <p>
                  Drafts stay visible to event administrators. Published events
                  accept submissions only within their schedule.
                </p>
              </div>
              <div class="publish-field">
                <Checkbox bind:checked={form.clubOnly}
                  >Club members only</Checkbox
                >
                <p>
                  When checked, only teams/users assigned by admin as Club Members can view and compete in this event. Unchecked events are public for everyone.
                </p>
              </div>
            </fieldset>
            {#if creating}
              <div class="source-controls">
                <SettingsField
                  label="Challenge source"
                  description="Challenges are sourced from the Challenge Bank."
                >
                  {#snippet children({ id })}
                    <select {id} value="bank" disabled>
                      <option value="bank" disabled={!canReadBank}>
                        Challenge bank{!canReadBank
                          ? ' (read permission required)'
                          : ''}
                      </option>
                    </select>
                  {/snippet}
                </SettingsField>
              </div>
              {#if bank.isPending}
                <p class="empty" role="status">Loading challenges…</p>
              {:else if bank.isError}
                <div class="source-status">
                  <p>{bank.error?.message}</p>
                  <Button size="sm" onclick={() => bank.refetch()}
                    >Retry challenges</Button
                  >
                </div>
              {:else if !canReadBank}
                <p class="empty">
                  Challenge read permission is required to select challenges from the bank.
                </p>
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
              <div class="event-summary-box">
                <h3>Event Overview</h3>
                <div class="summary-stats-grid">
                  <div class="stat-card">
                    <span class="stat-label">Challenges</span>
                    <span class="stat-val">{eventChallenges.length} challenges ({totalEventPoints} pts)</span>
                  </div>
                  <div class="stat-card">
                    <span class="stat-label">Participants</span>
                    <span class="stat-val">{selected?.participantCount ?? 0}</span>
                  </div>
                  <div class="stat-card">
                    <span class="stat-label">Status</span>
                    <span class="stat-val">{clubEventPhase(selected!, now)}</span>
                  </div>
                </div>
                <p class="hint">
                  Manage event challenges and view static flags in the <strong>Challenges</strong> tab. Review and moderate submissions in the <strong>Submissions</strong> tab.
                </p>
              </div>
            {/if}
          </div>
          <footer>
            <div class="lifecycle-actions">
              {#if selected}<Button
                  variant="outline"
                  size="sm"
                  disabled={saving || !canCloseClubEvent(selected, now)}
                  onclick={() => {
                    error = ''
                    action = { kind: 'close', event: selected! }
                  }}>Close event</Button
                >{/if}
            </div>
            <div class="footer-save-group">
              {#if saveSuccess}
                <span class="save-status-badge">Changes saved successfully</span>
              {/if}
              <Button
                type="submit"
                disabled={saving || saveSuccess || (creating && !chosenIds.length)}
                class={saveSuccess ? 'btn-saved' : ''}
                >{saving
                  ? 'Saving...'
                  : saveSuccess
                    ? 'Saved'
                    : creating
                      ? 'Create event'
                      : 'Save changes'}</Button
              >
            </div>
          </footer>
        </form>
      {:else if !creating && activeTab === 'challenges'}
        <div class="tab-content-scroll">
          {#if notice}<p class="notice" role="status">{notice}</p>{/if}
          {#if error}<p class="error" role="alert">{error}</p>{/if}

          <div class="tab-action-toolbar">
            <div class="search-wrap">
              <Input
                bind:value={challengeSearchInEvent}
                placeholder="Search challenges in event…"
                aria-label="Search challenges in event"
              />
            </div>
            <div class="toolbar-stats">
              <span>{eventChallengesFiltered.length} / {eventChallenges.length} challenges</span>
              <span>·</span>
              <span>{totalEventPoints} pts</span>
              <span>·</span>
              <span>{totalEventSolves} solves</span>
            </div>
            {#if canReadBank}
              <Button
                size="sm"
                variant={isAddingChallenges ? 'outline' : 'default'}
                onclick={() => {
                  isAddingChallenges = !isAddingChallenges
                  addingChallengeIds = []
                  addChallengeSearch = ''
                }}
              >
                {isAddingChallenges ? 'Close picker' : '+ Add challenges from bank'}
              </Button>
            {/if}
          </div>

          {#if isAddingChallenges}
            <div class="bank-picker-card">
              <div class="bank-picker-header">
                <div>
                  <h4>Add Challenges from Challenge Bank</h4>
                  <p>Select challenges from the Challenge Bank to add to this event.</p>
                </div>
                <div class="bank-picker-actions">
                  <Button
                    size="sm"
                    disabled={!addingChallengeIds.length || saving}
                    onclick={addChallengesToEvent}
                  >
                    Add ({addingChallengeIds.length}) challenges
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onclick={() => {
                      isAddingChallenges = false
                      addingChallengeIds = []
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
              <div class="bank-picker-search">
                <Input
                  bind:value={addChallengeSearch}
                  placeholder="Filter bank challenges by name, category…"
                  aria-label="Filter bank challenges"
                />
              </div>
              <div class="bank-picker-list">
                {#if bank.isPending}
                  <p class="empty">Loading challenge bank…</p>
                {:else if bank.isError}
                  <p class="empty error">{bank.error.message}</p>
                {:else if !candidateBankChallenges.length}
                  <p class="empty">No remaining challenges in bank available to add.</p>
                {:else}
                  {#each candidateBankChallenges as chall (chall.id)}
                    <div class="bank-picker-item">
                      <Checkbox
                        checked={addingChallengeIds.includes(chall.id)}
                        disabled={saving}
                        onchange={event =>
                          toggleAddChallenge(
                            chall.id,
                            event.currentTarget.checked
                          )}
                      >
                        <span class="chall-check-label">
                          <strong>{chall.name}</strong>
                          <small>{chall.category} · {chall.points.max} pts</small>
                        </span>
                      </Checkbox>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          {/if}

          {#if detail.isPending}
            <div class="status" role="status">
              <Spinner />
              <p>Loading challenges…</p>
            </div>
          {:else if detail.isError}
            <div class="source-status">
              <p>{detail.error.message}</p>
              <Button size="sm" onclick={() => detail.refetch()}>Retry</Button>
            </div>
          {:else if !eventChallengesFiltered.length}
            <p class="empty">No matching challenges in this event.</p>
          {:else}
            <div class="event-challs-grid">
              {#each eventChallengesFiltered as chall (chall.id)}
                <div class="event-chall-card">
                  <div class="chall-card-main">
                    <div class="chall-card-header">
                      <span class="chall-card-title">{chall.name}</span>
                      <span class="cat-badge">{chall.category}</span>
                      <span class="chall-points">{chall.points} pts</span>
                      <span class="chall-solves">{chall.solves} solves</span>
                    </div>

                    {#if chall.flags && chall.flags.length > 0}
                      <div class="chall-flags-list">
                        <span class="flag-label">Static flag:</span>
                        {#each chall.flags as flag}
                          <code class="flag-chip">{flag}</code>
                        {/each}
                      </div>
                    {/if}

                    {#if chall.description}
                      <div class="chall-desc-snippet">
                        {chall.description}
                      </div>
                    {/if}
                  </div>

                  <div class="chall-card-actions">
                    <Button
                      size="sm"
                      variant="outline"
                      class="btn-delete-chall"
                      disabled={saving}
                      onclick={() => (challengeToDelete = chall.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {:else if !creating && activeTab === 'submissions'}
        <div class="tab-content-scroll">
          {#if notice}<p class="notice" role="status">{notice}</p>{/if}
          {#if error}<p class="error" role="alert">{error}</p>{/if}

          <div class="tab-action-toolbar submissions-toolbar">
            <div class="search-wrap">
              <Input
                bind:value={subSearch}
                placeholder="Search user, challenge, flag…"
                aria-label="Search submissions"
              />
            </div>
            <div class="filter-selects">
              <select bind:value={subChallengeFilter} aria-label="Filter by challenge">
                <option value="all">All challenges ({eventChallenges.length})</option>
                {#each eventChallenges as c (c.id)}
                  <option value={c.id}>{c.name}</option>
                {/each}
              </select>
              <select bind:value={subResultFilter} aria-label="Filter by result">
                <option value="all">All results</option>
                <option value="correct">Correct (Solve)</option>
                <option value="incorrect">Incorrect</option>
                <option value="alreadySolved">Already solved</option>
              </select>
            </div>
            <div class="toolbar-stats">
              <span>{filteredSubmissions.length} / {submissionsList.length} submissions</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onclick={() => submissionsQuery.refetch()}
              disabled={submissionsQuery.isFetching}
            >
              Refresh
            </Button>
          </div>

          {#if submissionsQuery.isPending}
            <div class="status" role="status">
              <Spinner />
              <p>Loading submission history…</p>
            </div>
          {:else if submissionsQuery.isError}
            <div class="source-status">
              <p>{submissionsQuery.error.message}</p>
              <Button size="sm" onclick={() => submissionsQuery.refetch()}>Retry</Button>
            </div>
          {:else if !filteredSubmissions.length}
            <p class="empty">No matching flag submissions found.</p>
          {:else}
            <div class="subs-table-wrap">
              <table class="subs-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>User / Team</th>
                    <th>Challenge</th>
                    <th>Submitted flag</th>
                    <th>Result</th>
                    <th class="th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {#each filteredSubmissions as sub (sub.id)}
                    <tr class="sub-row" class:is-correct={sub.result === 'correct'}>
                      <td class="col-time">{new Date(sub.createdAt).toLocaleString('en', { dateStyle: 'short', timeStyle: 'medium' })}</td>
                      <td class="col-user"><strong>{sub.userName}</strong></td>
                      <td class="col-chall">{sub.challengeName}</td>
                      <td class="col-flag">
                        {#if sub.submittedFlag}
                          <code class="sub-flag-text">{sub.submittedFlag}</code>
                        {:else}
                          <span class="sub-flag-empty">—</span>
                        {/if}
                      </td>
                      <td class="col-result">
                        {#if sub.result === 'correct'}
                          <span class="status-badge badge-correct">Solve</span>
                        {:else if sub.result === 'incorrect'}
                          <span class="status-badge badge-incorrect">Incorrect</span>
                        {:else}
                          <span class="status-badge badge-already">Already solved</span>
                        {/if}
                      </td>
                      <td class="col-actions">
                        {#if sub.isSolve && sub.solveId}
                          <Button
                            size="sm"
                            variant="outline"
                            class="btn-revoke-solve"
                            disabled={saving}
                            onclick={() => (solveToDelete = sub.solveId ?? null)}
                          >
                            Revoke solve
                          </Button>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</section>

<Dialog
  open={!!action && allowed}
  onOpenChange={open => {
    if (!open && !saving) action = null
  }}
  title="Close event"
  description="End submissions now and keep the current event scores."
>
  {#snippet children()}
    {#if action}<p class="dialog-name">{action.event.name}</p>{/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="dialog-actions">
      <Button variant="ghost" disabled={saving} onclick={() => (action = null)}
        >Cancel</Button
      ><Button disabled={saving} onclick={confirmAction}
        >{saving ? 'Saving…' : 'Close event'}</Button
      >
    </div>
  {/snippet}
</Dialog>

<Dialog
  open={!!challengeToDelete && allowed}
  onOpenChange={open => {
    if (!open && !saving) challengeToDelete = null
  }}
  title="Confirm Challenge Removal"
  description="Are you sure you want to remove this challenge from the event? Submissions and points for this challenge in this event will be deleted."
>
  {#snippet children()}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="dialog-actions">
      <Button variant="ghost" disabled={saving} onclick={() => (challengeToDelete = null)}>Cancel</Button>
      <Button disabled={saving} onclick={() => challengeToDelete && removeChallengeFromEvent(challengeToDelete)}>
        {saving ? 'Removing…' : 'Remove challenge'}
      </Button>
    </div>
  {/snippet}
</Dialog>

<Dialog
  open={!!solveToDelete && allowed}
  onOpenChange={open => {
    if (!open && !saving) solveToDelete = null
  }}
  title="Confirm Revoke Solve"
  description="Are you sure you want to revoke this solve? The score will be deducted and event leaderboard will be automatically recalculated."
>
  {#snippet children()}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="dialog-actions">
      <Button variant="ghost" disabled={saving} onclick={() => (solveToDelete = null)}>Cancel</Button>
      <Button disabled={saving} onclick={() => solveToDelete && revokeSolve(solveToDelete)}>
        {saving ? 'Revoking…' : 'Revoke solve'}
      </Button>
    </div>
  {/snippet}
</Dialog>

{#if toast}
  <div class="toast-container" role="status" aria-live="polite">
    <div class="toast">
      <div class="toast-indicator"></div>
      <div class="toast-content">
        <span class="toast-title">Success</span>
        <span class="toast-message">{toast.message}</span>
      </div>
      <button
        type="button"
        class="toast-close"
        onclick={dismissToast}
        aria-label="Close notification"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
          <path
            d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"
          />
        </svg>
      </button>
    </div>
  </div>
{/if}

<style>
  .event-admin {
    display: flex;
    flex-direction: column;
    inline-size: 100%;
    flex: 1;
    min-block-size: 0;
    block-size: calc(100dvh - var(--header-height));
    overflow: hidden;
  }
  .editor,
  .event-form {
    display: flex;
    flex-direction: column;
    inline-size: 100%;
    flex: 1;
    min-inline-size: 0;
    min-block-size: 0;
  }
  .heading-left {
    display: flex;
    align-items: center;
    gap: 1rem;
    min-inline-size: 0;
  }
  .editor-heading,
  .challenge-toolbar,
  footer,
  .dialog-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .editor-heading {
    flex-shrink: 0;
    padding: 1rem 1.25rem;
    border-block-end: 1px solid var(--border);
    background: var(--background-l1);
  }
  h2 {
    font-size: 1.15rem;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .heading-meta {
    min-inline-size: 0;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }
  .editor-heading p,
  .hint,
  .publish-field p {
    margin-block-start: 0.25rem;
    color: var(--foreground-l3);
    font-size: 0.75rem;
    line-height: 1.6;
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
  .timing-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }
  .source-controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    max-inline-size: 24rem;
    gap: 1rem;
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
    font-family: var(--font-sans);
    font-variant-numeric: tabular-nums;
    font-size: 0.7rem;
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
  :global(.btn-saved) {
    background: rgba(0, 255, 128, 0.2) !important;
    border-color: #00ff80 !important;
    color: #00ff80 !important;
    box-shadow: 0 0 12px rgba(0, 255, 128, 0.3) !important;
  }
  .notice,
  .error {
    margin-block-end: 1rem;
    font-size: 0.825rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
    padding: 0.75rem 1rem;
    border-radius: var(--radius-sm, 6px);
    font-family: var(--font-sans);
    font-weight: 500;
  }
  .notice {
    background: rgba(0, 255, 128, 0.12);
    border: 1px solid rgba(0, 255, 128, 0.45);
    color: #00ff80;
    box-shadow: 0 0 15px rgba(0, 255, 128, 0.08);
  }
  .error {
    background: rgba(255, 77, 77, 0.12);
    border: 1px solid rgba(255, 77, 77, 0.45);
    color: #ff5555;
    box-shadow: 0 0 15px rgba(255, 77, 77, 0.08);
  }

  .footer-save-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .save-status-badge {
    color: var(--club-accent-text);
    font-size: 0.8125rem;
    font-weight: 600;
    padding: 0.35rem 0.75rem;
    background: rgba(0, 255, 128, 0.12);
    border: 1px solid rgba(0, 255, 128, 0.4);
    border-radius: var(--radius-sm);
  }

  /* Toast Notification */
  .toast-container {
    position: fixed;
    bottom: 5.5rem;
    right: 2rem;
    z-index: 99999;
    pointer-events: auto;
    animation: toast-slide-up 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes toast-slide-up {
    from {
      opacity: 0;
      transform: translateY(1rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.75rem 1.15rem;
    background: rgba(8, 20, 14, 0.96);
    backdrop-filter: blur(12px);
    border: 1px solid #00ff80;
    border-radius: var(--radius-md, 8px);
    box-shadow:
      0 10px 30px rgba(0, 0, 0, 0.8),
      0 0 20px rgba(0, 255, 128, 0.25);
    font-family: var(--font-sans);
    min-inline-size: 20rem;
    max-inline-size: 90vw;
  }

  .toast-indicator {
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    background: #00ff80;
    box-shadow: 0 0 8px #00ff80;
    flex-shrink: 0;
  }

  .toast-content {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    flex: 1;
    min-inline-size: 0;
  }

  .toast-title {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #00ff80;
  }

  .toast-message {
    font-size: 0.85rem;
    color: #e5ffe8;
    line-height: 1.4;
  }

  .toast-close {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.35rem;
    border: none;
    background: transparent;
    color: var(--foreground-l3);
    border-radius: 4px;
    cursor: pointer;
    transition: color 0.15s ease, background-color 0.15s ease;
    flex-shrink: 0;
  }

  .toast-close:hover {
    color: #00ff80;
    background: rgba(0, 255, 128, 0.12);
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

  /* Tabs navigation */
  .editor-tabs {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem 1.25rem;
    background: var(--background-l1);
    border-block-end: 1px solid var(--border);
    flex-shrink: 0;
  }
  .tab-btn {
    padding: 0.45rem 0.85rem;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--foreground-l2);
    cursor: pointer;
    font-size: 0.825rem;
    font-family: var(--font-sans);
    font-weight: 600;
    transition: all 0.15s ease;
  }
  .tab-btn:hover {
    background: var(--background-l2);
    color: var(--foreground-l0);
  }
  .tab-btn.active {
    background: var(--club-accent-soft);
    color: var(--club-accent-text);
    border-color: rgba(0, 255, 128, 0.4);
    box-shadow: 0 0 10px rgba(0, 255, 128, 0.15);
  }

  /* Summary box in settings */
  .event-summary-box {
    margin-block-start: 1.5rem;
    padding: 1rem;
    background: var(--background-l2);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .summary-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.75rem;
    margin-block: 0.75rem;
  }
  .stat-card {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem;
    background: var(--background-l3);
    border-radius: var(--radius-sm);
  }
  .stat-label {
    font-size: 0.7rem;
    color: var(--foreground-l3);
    text-transform: uppercase;
  }
  .stat-val {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--club-accent-text);
    font-family: var(--font-sans);
    font-variant-numeric: tabular-nums;
  }

  /* Shared Tab Scroll & Action Toolbar */
  .tab-content-scroll {
    flex: 1;
    min-block-size: 0;
    overflow-y: auto;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .tab-action-toolbar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    background: var(--background-l1);
    padding: 0.75rem 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .search-wrap {
    flex: 1;
    min-inline-size: 14rem;
  }
  .toolbar-stats {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: var(--foreground-l3);
    font-family: var(--font-sans);
    font-variant-numeric: tabular-nums;
  }

  /* Bank picker panel */
  .bank-picker-card {
    background: var(--background-l2);
    border: 1px solid rgba(0, 255, 128, 0.3);
    border-radius: var(--radius-md);
    padding: 1rem;
    box-shadow: 0 0 15px rgba(0, 255, 128, 0.05);
  }
  .bank-picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-block-end: 0.75rem;
  }
  .bank-picker-header h4 {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--club-accent-text);
  }
  .bank-picker-header p {
    font-size: 0.75rem;
    color: var(--foreground-l3);
    margin-block-start: 0.2rem;
  }
  .bank-picker-actions {
    display: flex;
    gap: 0.5rem;
  }
  .bank-picker-search {
    margin-block-end: 0.75rem;
  }
  .bank-picker-list {
    max-block-size: 16rem;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--background-l3);
  }
  .bank-picker-item {
    display: flex;
    align-items: center;
    padding: 0.6rem 0.75rem;
    border-block-end: 1px solid var(--border);
  }
  .bank-picker-item:last-child {
    border-block-end: none;
  }
  .chall-check-label strong {
    display: block;
    font-size: 0.8rem;
    color: var(--foreground-l0);
  }
  .chall-check-label small {
    display: block;
    font-size: 0.7rem;
    color: var(--foreground-l3);
    font-family: var(--font-sans);
  }

  /* Challenges grid & cards */
  .event-challs-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .event-chall-card {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: var(--background-l2);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    transition: border-color 0.15s ease;
  }
  .event-chall-card:hover {
    border-color: rgba(0, 255, 128, 0.3);
  }
  .chall-card-main {
    flex: 1;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .chall-card-header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.6rem;
  }
  .chall-card-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--foreground-l0);
  }
  .cat-badge {
    padding: 0.15rem 0.5rem;
    border-radius: var(--radius-sm);
    background: var(--background-l4);
    color: var(--foreground-l2);
    font-size: 0.7rem;
    text-transform: uppercase;
    font-family: var(--font-sans);
    font-weight: 600;
  }
  .chall-points {
    color: var(--club-accent-text);
    font-family: var(--font-sans);
    font-variant-numeric: tabular-nums;
    font-size: 0.8rem;
    font-weight: 600;
  }
  .chall-solves {
    color: var(--foreground-l3);
    font-family: var(--font-sans);
    font-variant-numeric: tabular-nums;
    font-size: 0.75rem;
  }
  .chall-flags-list {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .flag-label {
    font-size: 0.72rem;
    color: var(--foreground-l3);
    font-family: var(--font-sans);
    font-weight: 500;
  }
  .flag-chip {
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    background: rgba(0, 255, 128, 0.08);
    border: 1px solid rgba(0, 255, 128, 0.25);
    color: var(--club-accent-text);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    word-break: break-all;
  }
  .chall-desc-snippet {
    font-size: 0.75rem;
    color: var(--foreground-l3);
    line-height: 1.5;
    max-inline-size: 50rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .chall-card-actions {
    flex-shrink: 0;
  }

  /* Submissions toolbar & table */
  .submissions-toolbar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .filter-selects {
    display: flex;
    gap: 0.5rem;
  }
  .filter-selects select {
    min-inline-size: 9rem;
    block-size: 2.25rem;
  }
  .subs-table-wrap {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--background-l1);
  }
  .subs-table {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
    text-align: start;
  }
  .subs-table th {
    padding: 0.75rem 1rem;
    background: var(--background-l2);
    border-block-end: 1px solid var(--border);
    color: var(--foreground-l2);
    font-weight: 500;
    font-size: 0.75rem;
    white-space: nowrap;
  }
  .subs-table td {
    padding: 0.75rem 1rem;
    border-block-end: 1px solid var(--border);
    vertical-align: middle;
  }
  .sub-row:hover {
    background: var(--background-l2);
  }
  .sub-row.is-correct {
    background: rgba(0, 255, 128, 0.03);
  }
  .col-time {
    color: var(--foreground-l3);
    font-family: var(--font-sans);
    font-variant-numeric: tabular-nums;
    font-size: 0.72rem;
    white-space: nowrap;
  }
  .col-user {
    color: var(--foreground-l0);
    white-space: nowrap;
  }
  .col-chall {
    color: var(--foreground-l1);
    font-weight: 500;
    white-space: nowrap;
  }
  .col-flag {
    max-inline-size: 18rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sub-flag-text {
    padding: 0.15rem 0.4rem;
    background: var(--background-l3);
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--foreground-l1);
    word-break: break-all;
  }
  .sub-flag-empty {
    color: var(--foreground-l4);
  }
  .status-badge {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    border-radius: var(--radius-sm);
    font-size: 0.7rem;
    font-family: var(--font-sans);
    font-weight: 600;
    white-space: nowrap;
  }
  .badge-correct {
    background: rgba(0, 255, 128, 0.12);
    border: 1px solid rgba(0, 255, 128, 0.3);
    color: #00ff80;
  }
  .badge-incorrect {
    background: rgba(255, 77, 77, 0.12);
    border: 1px solid rgba(255, 77, 77, 0.3);
    color: #ff4d4d;
  }
  .badge-already {
    background: rgba(255, 204, 0, 0.12);
    border: 1px solid rgba(255, 204, 0, 0.3);
    color: #ffcc00;
  }
  .col-actions {
    white-space: nowrap;
    text-align: end;
  }
  .th-actions {
    text-align: end;
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
