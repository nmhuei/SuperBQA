<script lang="ts">
  import {
    GoodAdminSettingsUpdate,
    GoodClubMemberUpdate,
    UpdateAdminSettingsRouteV2,
    UpdateClubMemberRouteV2,
  } from '@rctf/types'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { onMount } from 'svelte'
  import { apiRequest } from '$lib/api'
  import { useAdminSettings } from '$lib/query/admin'
  import {
    CLUB_MEMBERS_PAGE_SIZE,
    clubQueryKeys,
    useClubAccess,
    useClubMembers,
  } from '$lib/query/club'
  import { useClientConfig } from '$lib/query/config'
  import { queryKeys } from '$lib/query/keys'
  import Button from '$lib/ui/button.svelte'
  import Card from '$lib/ui/card.svelte'
  import Dialog from '$lib/ui/dialog.svelte'
  import Input from '$lib/ui/input.svelte'
  import Spinner from '$lib/ui/spinner.svelte'
  import {
    formatDatetimeLocal,
    parseDatetimeLocal,
  } from '../settings/settings-model'

  const queryClient = useQueryClient()
  const access = useClubAccess()
  const config = useClientConfig()
  const canManageMembers = $derived(
    access.data?.canManageMembers === true && !access.isError
  )
  const canManageArchives = $derived(
    access.data?.canManageArchives === true && !access.isError
  )
  const settings = useAdminSettings(() => canManageArchives)
  let searchInput = $state('')
  let search = $state('')
  let offset = $state(0)
  const members = useClubMembers(
    () => search,
    () => offset,
    () => canManageMembers
  )
  let busyMember = $state('')
  let saving = $state(false)
  let notice = $state('')
  let noticeError = $state(false)
  let now = $state(Date.now())
  let openEventDialog = $state(false)
  let eventEnd = $state('')
  let dialogError = $state('')
  const mode = $derived(
    settings.data?.overrides.clubMode ??
      settings.data?.defaults.clubMode ??
      config.data?.clubMode ??
      'event'
  )
  const startTime = $derived(
    settings.data?.overrides.startTime ??
      settings.data?.defaults.startTime ??
      config.data?.startTime ??
      0
  )
  const endTime = $derived(
    settings.data?.overrides.endTime ??
      settings.data?.defaults.endTime ??
      config.data?.endTime ??
      0
  )
  const eventEnded = $derived(endTime > 0 && now >= endTime)
  const eventName = $derived(
    settings.data?.overrides.ctfName ??
      settings.data?.defaults.ctfName ??
      config.data?.ctfName ??
      'Current event'
  )
  const eventLive = $derived(now >= startTime && now < endTime)
  const eventState = $derived(
    eventEnded ? 'Ended' : now < startTime ? 'Upcoming' : 'Open'
  )
  const membersPageCount = $derived(
    Math.max(1, Math.ceil((members.data?.total ?? 0) / CLUB_MEMBERS_PAGE_SIZE))
  )
  const membersPage = $derived(Math.floor(offset / CLUB_MEMBERS_PAGE_SIZE))
  const dateTime = (value: number) =>
    new Date(value).toLocaleString('en', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })

  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 1000)
    return () => clearInterval(timer)
  })
  function message(text: string, error = false) {
    notice = text
    noticeError = error
  }
  async function refreshSettings() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.clientConfig }),
      queryClient.invalidateQueries({ queryKey: queryKeys.adminSettings }),
      queryClient.invalidateQueries({ queryKey: clubQueryKeys.access }),
    ])
  }
  async function updateSettings(
    data: { clubMode?: 'club' | 'event'; startTime?: number; endTime?: number },
    text: string
  ) {
    if (saving) return false
    saving = true
    dialogError = ''
    try {
      const response = await apiRequest(UpdateAdminSettingsRouteV2, { data })
      if (response.kind !== GoodAdminSettingsUpdate.kind) {
        message(response.message, true)
        dialogError = response.message
        return false
      }
      await refreshSettings()
      message(text)
      return true
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : 'Settings could not be saved. Please retry.'
      message(text, true)
      dialogError = text
      return false
    } finally {
      saving = false
    }
  }
  async function setRole(id: string, role: 'guest' | 'member', name: string) {
    if (busyMember) return
    busyMember = id
    try {
      const response = await apiRequest(UpdateClubMemberRouteV2, { id, role })
      if (response.kind !== GoodClubMemberUpdate.kind) {
        message(response.message, true)
        return
      }
      await queryClient.invalidateQueries({ queryKey: clubQueryKeys.all })
      message(`${name} is now a ${role === 'member' ? 'Member' : 'Guest'}.`)
    } catch (error) {
      message(
        error instanceof Error
          ? error.message
          : 'Membership could not be updated. Please retry.',
        true
      )
    } finally {
      busyMember = ''
    }
  }
  function prepareOpen() {
    eventEnd = formatDatetimeLocal(
      endTime > Date.now() ? endTime : Date.now() + 86_400_000
    )
    dialogError = ''
    openEventDialog = true
  }
  async function openEvent(event: SubmitEvent) {
    event.preventDefault()
    const end = parseDatetimeLocal(eventEnd)
    if (end === null || end <= Date.now()) {
      dialogError = 'Choose an end time in the future.'
      return
    }
    const start = startTime > Date.now() ? Date.now() : startTime
    if (
      await updateSettings(
        { clubMode: 'event', startTime: start, endTime: end },
        'Event opened. Scored submissions are enabled.'
      )
    )
      openEventDialog = false
  }
</script>

<svelte:head><title>Club management | Admin</title></svelte:head>

<section class="admin-club" aria-labelledby="club-admin-title">
  <h1 id="club-admin-title" data-visually-hidden>Club management</h1>
  {#if notice}<p class="notice" class:error={noticeError} role="status">
      {notice}
    </p>{/if}
  {#if access.isPending}<div class="status" role="status">
      <Spinner />
      <p>Checking administrator access…</p>
    </div>
  {:else if access.isError}<div class="status">
      <Card title="Unable to check access" description={access.error.message}
        ><Button onclick={() => access.refetch()}>Retry</Button></Card
      >
    </div>
  {:else if !canManageMembers && !canManageArchives}<div class="status">
      <Card
        title="Club management access required"
        description="Your account needs member-management or event-settings permission."
        ><Button href="/">Back to club</Button></Card
      >
    </div>
  {:else}
    <div class="admin-workspace">
      <section class="members-panel" aria-labelledby="members-title">
        <div class="panel-heading">
          <div>
            <h2 id="members-title">Membership</h2>
          </div>
          <span class="count">{members.data?.total ?? '—'} accounts</span>
        </div>
        {#if !canManageMembers}<div class="status">
            <p>Member-management permission is required to change roles.</p>
          </div>
        {:else}
          <form
            class="search"
            onsubmit={event => {
              event.preventDefault()
              search = searchInput.trim()
              offset = 0
            }}
          >
            <label class="sr-only" for="member-search"
              >Search team name or email</label
            ><Input
              id="member-search"
              bind:value={searchInput}
              maxlength={100}
              placeholder="Search team name or email…"
            /><Button type="submit" variant="outline" size="sm">Search</Button>
          </form>
          <div class="members-list">
            {#if members.isPending}<div class="status" role="status">
                <Spinner />
                <p>Loading accounts…</p>
              </div>
            {:else if members.isError}<div class="status">
                <p>{members.error.message}</p>
                <Button onclick={() => members.refetch()} size="sm"
                  >Retry</Button
                >
              </div>
            {:else if !members.data?.users.length}<div class="status">
                <p>No accounts match this search.</p>
              </div>
            {:else}<table>
                <thead
                  ><tr
                    ><th scope="col">Account / team</th><th scope="col">Role</th
                    ><th scope="col" class="role-action">Access</th></tr
                  ></thead
                ><tbody
                  >{#each members.data.users as member (member.id)}<tr
                      ><td
                        ><strong>{member.name}</strong><span class="email"
                          >{member.email ?? 'No email address'}</span
                        ></td
                      ><td
                        ><span
                          class="role"
                          class:member-role={member.role === 'member'}
                          >{member.role === 'member' ? 'Member' : 'Guest'}</span
                        ></td
                      ><td class="role-action"
                        ><Button
                          size="sm"
                          variant={member.role === 'member'
                            ? 'ghost'
                            : 'outline'}
                          disabled={!!busyMember}
                          onclick={() =>
                            setRole(
                              member.id,
                              member.role === 'member' ? 'guest' : 'member',
                              member.name
                            )}
                          >{busyMember === member.id
                            ? 'Saving…'
                            : member.role === 'member'
                              ? 'Revoke'
                              : 'Grant Member'}</Button
                        ></td
                      ></tr
                    >{/each}</tbody
                >
              </table>{/if}
          </div>
          {#if membersPageCount > 1}<footer>
              <div class="pagination">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={offset === 0 || members.isPending}
                  onclick={() =>
                    (offset = Math.max(0, offset - CLUB_MEMBERS_PAGE_SIZE))}
                  >Previous</Button
                ><span>{membersPage + 1} / {membersPageCount}</span><Button
                  variant="ghost"
                  size="sm"
                  disabled={!members.data ||
                    offset + CLUB_MEMBERS_PAGE_SIZE >= members.data.total ||
                    members.isPending}
                  onclick={() => (offset += CLUB_MEMBERS_PAGE_SIZE)}
                  >Next</Button
                >
              </div>
            </footer>{/if}
        {/if}
      </section>
      <aside class="event-panel" aria-label="Event management">
        {#if !canManageArchives}<Card
            title="Event management"
            description="Event-settings permission is required to change modes and close events."
            ><Button href="/challenges" variant="outline"
              >View current event</Button
            ></Card
          >
        {:else if settings.isPending}<div class="status" role="status">
            <Spinner />
            <p>Loading event settings…</p>
          </div>
        {:else if settings.isError}<Card
            title="Unable to load settings"
            description={settings.error.message}
            ><Button onclick={() => settings.refetch()}>Retry</Button></Card
          >
        {:else}
          <section class="event-card">
            <div class="panel-heading">
              <h2>Platform mode</h2>
            </div>
            <div class="mode-buttons" role="group" aria-label="Platform mode">
              <Button
                variant={mode === 'club' ? 'default' : 'outline'}
                disabled={saving || mode === 'club'}
                onclick={() =>
                  updateSettings(
                    { clubMode: 'club' },
                    'Club mode enabled. Current scored submissions are closed.'
                  )}>Club</Button
              ><Button
                variant={mode === 'event' ? 'default' : 'outline'}
                disabled={saving || mode === 'event'}
                onclick={() =>
                  updateSettings(
                    { clubMode: 'event' },
                    'Event mode enabled. The existing schedule is unchanged.'
                  )}>Event</Button
              >
            </div>
          </section>
          <section class="event-card">
            <div class="panel-heading">
              <h2>{eventName}</h2>
              <span
                class="event-state"
                class:live={eventLive && mode === 'event'}
                >{mode === 'club' ? 'Scoring closed' : eventState}</span
              >
            </div>
            <dl>
              <div>
                <dt>Starts</dt>
                <dd>{dateTime(startTime)}</dd>
              </div>
              <div>
                <dt>Ends</dt>
                <dd>{dateTime(endTime)}</dd>
              </div>
            </dl>
            <div class="event-actions">
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onclick={prepareOpen}
                >{eventEnded ? 'Reopen event' : 'Open event'}</Button
              ><Button
                size="sm"
                variant="secondary"
                disabled={saving || !eventLive}
                onclick={() =>
                  updateSettings(
                    { clubMode: 'event', endTime: Date.now() },
                    'Event ended. Scored submissions are closed.'
                  )}>Close event</Button
              >
            </div>
          </section>
        {/if}
      </aside>
    </div>
  {/if}
</section>

<Dialog
  bind:open={openEventDialog}
  title={eventEnded ? 'Reopen this event' : 'Open event'}
  description="Existing scores and challenges are kept. Scored submissions will be enabled until the end time you choose."
>
  {#snippet children({ closeProps })}<form
      class="dialog-form"
      onsubmit={openEvent}
    >
      <label for="event-end">End time (your local time)</label><Input
        id="event-end"
        type="datetime-local"
        bind:value={eventEnd}
        required
      />
      <p class="help">
        The original start time is preserved for an event that has already
        started.
      </p>
      {#if dialogError}<p class="form-error" role="alert">{dialogError}</p>{/if}
      <div class="dialog-actions">
        <Button variant="ghost" {...closeProps} disabled={saving}>Cancel</Button
        ><Button type="submit" disabled={saving}
          >{saving ? 'Saving…' : 'Open event'}</Button
        >
      </div>
    </form>{/snippet}
</Dialog>

<style>
  .admin-club {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    inline-size: 100%;
    block-size: calc(100dvh - var(--header-height));
    min-block-size: 0;
    padding: 1rem;
  }
  .panel-heading,
  footer,
  .pagination,
  .event-actions,
  .dialog-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .admin-workspace {
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) minmax(300px, 1fr);
    gap: 1.5rem;
    flex: 1;
    min-block-size: 0;
  }
  .members-panel {
    display: flex;
    flex-direction: column;
    min-block-size: 0;
    min-inline-size: 0;
    border-block: 1px solid var(--club-border);
    overflow: hidden;
  }
  .panel-heading {
    padding: 1rem;
    flex-shrink: 0;
  }
  h2 {
    font-size: 0.95rem;
    color: var(--foreground-l0);
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .count {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--club-muted);
    white-space: nowrap;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 1rem 0.75rem;
  }
  .search :global(input) {
    min-inline-size: 0;
    flex: 1;
    font-size: 0.8rem;
  }
  .members-list {
    flex: 1;
    min-block-size: 0;
    overflow: auto;
  }
  table {
    inline-size: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  th,
  td {
    padding: 0.55rem 1rem;
    text-align: start;
    border-block-end: 1px solid var(--club-border);
  }
  th {
    color: var(--club-muted);
    font-size: 0.6rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  th:first-child {
    inline-size: 49%;
  }
  th:nth-child(2) {
    inline-size: 17%;
  }
  th:last-child {
    inline-size: 34%;
  }
  td strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--foreground-l0);
  }
  .email {
    display: block;
    margin-block-start: 0.2rem;
    overflow: hidden;
    color: var(--club-muted);
    font-size: 0.65rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .role {
    display: inline-block;
    color: var(--club-muted);
    font-size: 0.65rem;
    padding: 0.2rem 0.4rem;
    background: var(--club-panel-raised);
    border-radius: var(--radius-sm);
  }
  .member-role {
    background: var(--club-accent-soft);
    color: var(--club-accent-text);
  }
  .role-action {
    text-align: end;
  }
  .role-action :global(button) {
    font-size: 0.7rem;
    padding-inline: 0.65rem;
    block-size: 1.8rem;
  }
  footer {
    padding: 0.65rem 0.8rem;
    border-block-start: 1px solid var(--club-border);
    color: var(--club-muted);
    font-size: 0.6rem;
    justify-content: flex-end;
  }
  .pagination {
    gap: 0.2rem;
    white-space: nowrap;
  }
  .pagination :global(button) {
    font-size: 0.65rem;
    padding-inline: 0.45rem;
  }
  .event-panel {
    display: flex;
    flex-direction: column;
    gap: 0;
    min-block-size: 0;
    overflow-y: auto;
    border-block-start: 1px solid var(--club-border);
  }
  .event-card {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    padding: 1rem;
    border-block-end: 1px solid var(--club-border);
  }
  .event-card .panel-heading {
    padding: 0;
  }
  .mode-buttons {
    display: flex;
    gap: 0.5rem;
  }
  .mode-buttons :global(button) {
    flex: 1;
    font-size: 0.8rem;
  }
  .mode-buttons :global(button:disabled) {
    opacity: 1;
  }
  .help {
    color: var(--club-muted);
    font-size: 0.7rem;
    line-height: 1.5;
  }
  .event-state {
    color: var(--club-muted);
    font-size: 0.65rem;
  }
  .event-state.live {
    color: var(--club-accent-text);
  }
  dl {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  dl div {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.7rem;
  }
  dt {
    color: var(--club-muted);
  }
  dd {
    color: var(--foreground-l1);
  }
  .event-actions {
    justify-content: flex-start;
  }
  .event-actions :global(button) {
    flex: 1;
    font-size: 0.75rem;
  }
  .event-card > :global(button) {
    align-self: flex-start;
    font-size: 0.75rem;
  }
  .notice {
    color: var(--club-accent-text);
    font-size: 0.75rem;
  }
  .notice.error,
  .form-error {
    color: var(--foreground-destructive, #e39999);
  }
  .status {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem;
    color: var(--club-muted);
    font-size: 0.8rem;
    text-align: center;
  }
  .status :global(ui-card) {
    max-inline-size: 30rem;
    text-align: start;
  }
  .dialog-form {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    min-inline-size: min(24rem, 75vw);
  }
  .dialog-form label {
    font-size: 0.8rem;
    color: var(--foreground-l1);
  }
  .dialog-actions {
    justify-content: flex-end;
    margin-block-start: 0.5rem;
  }
  .form-error {
    font-size: 0.75rem;
  }
  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  @media (max-width: 900px) {
    .admin-workspace {
      grid-template-columns: 1fr;
    }
    .admin-club {
      block-size: auto;
      min-block-size: calc(100dvh - var(--header-height));
    }
    .members-panel {
      min-block-size: 30rem;
    }
    .event-panel {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      overflow: visible;
    }
  }
  @media (max-width: 600px) {
    .admin-club {
      padding: 0.75rem;
    }
    .event-panel {
      display: flex;
    }
    .panel-heading {
      gap: 0.4rem;
    }
    .count {
      display: none;
    }
    th,
    td {
      padding: 0.6rem;
    }
    th:first-child {
      inline-size: 42%;
    }
    th:nth-child(2) {
      inline-size: 20%;
    }
    th:last-child {
      inline-size: 38%;
    }
    footer {
      justify-content: flex-end;
    }
  }
</style>
