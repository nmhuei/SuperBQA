<script lang="ts">
  import {
    BadRateLimit,
    GoodClubEventSubmit,
    GoodClubPractice,
    SubmitClubEventRouteV2,
    SubmitClubPracticeRouteV2,
  } from '@rctf/types'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { apiRequest, isAuthenticated } from '$lib/api'
  import type { ArchivedChallenge } from '$lib/club/archive-model'
  import {
    solveCelebrationContext,
    type SolveCelebrations,
  } from '$lib/club/celebration'
  import { createPracticeSubmissionGuard } from '$lib/club/practice-submission'
  import ClubDetailGeometry from '$lib/components/club-detail-geometry.svelte'
  import Markdown from '$lib/components/markdown.svelte'
  import { IconCheck, IconPaperPlaneTilt } from '$lib/icons'
  import { clubQueryKeys, useClubAccess } from '$lib/query/club'
  import { clubEventQueryKeys } from '$lib/query/club-events'
  import { queryKeys } from '$lib/query/keys'
  import { useCurrentUser } from '$lib/query/user'
  import Button from '$lib/ui/button.svelte'
  import Input from '$lib/ui/input.svelte'
  import Spinner from '$lib/ui/spinner.svelte'
  import { getCategoryConfig } from '$lib/utils/categories'
  import { getContext, onDestroy, onMount, untrack } from 'svelte'

  interface Props {
    mode?: 'practice' | 'event'
    archiveId: string
    challenge: ArchivedChallenge
    solved: boolean
    allowed: boolean
    submissionOpen?: boolean
    closedMessage?: string
    onClose?: () => void
  }

  let {
    mode = 'practice',
    archiveId,
    challenge,
    solved,
    allowed,
    submissionOpen = true,
    closedMessage = 'Submissions are closed for this event.',
    onClose,
  }: Props = $props()
  const id = $props.id()
  const queryClient = useQueryClient()
  const user = useCurrentUser()
  const access = useClubAccess()
  const celebrations = getContext<SolveCelebrations>(solveCelebrationContext)
  const category = $derived(getCategoryConfig(challenge.category))
  const authorized = $derived(
    allowed &&
      access.data?.canAccessArchives === true &&
      !access.isError &&
      !!user.data &&
      !user.isError
  )
  let flag = $state('')
  let submitting = $state(false)
  let feedback = $state('')
  let success = $state(false)
  let confirmedSolved = $state(false)
  const isSolved = $derived(solved || confirmedSolved)
  const scope = $derived(
    JSON.stringify([mode, archiveId, challenge.id, user.data?.id ?? null])
  )

  const requests = createPracticeSubmissionGuard(() => {
    const currentUser = queryClient.getQueryState<{ id: string } | null>(
      queryKeys.userSelf
    )
    const currentAccess = queryClient.getQueryState<{
      canAccessArchives: boolean
    }>(clubQueryKeys.access)
    return {
      mode,
      userId:
        currentUser?.status === 'success'
          ? (currentUser.data?.id ?? null)
          : null,
      archiveId,
      challengeId: challenge.id,
      allowed:
        allowed &&
        isAuthenticated() &&
        currentAccess?.status === 'success' &&
        currentAccess.data?.canAccessArchives === true,
    }
  })

  onMount(() =>
    queryClient.getQueryCache().subscribe(event => {
      const key = event.query.queryKey
      if (
        (key[0] === queryKeys.userSelf[0] &&
          key[1] === queryKeys.userSelf[1]) ||
        (key[0] === clubQueryKeys.access[0] &&
          key[1] === clubQueryKeys.access[1])
      )
        requests.refresh()
    })
  )
  onDestroy(() => requests.dispose())

  $effect(() => {
    void scope
    untrack(() => requests.refresh())
    flag = ''
    feedback = ''
    success = false
    submitting = false
    confirmedSolved = false
  })

  $effect(() => {
    // Selection is keyed by the workspace. Also retire pending requests if
    // permission or identity changes before Svelte tears down this detail.
    void archiveId
    void challenge.id
    void authorized
    void user.data?.id
    requests.refresh()
    if (!authorized) {
      flag = ''
      feedback = ''
      submitting = false
    }
  })

  async function submitFlag(event: SubmitEvent) {
    event.preventDefault()
    if (
      !authorized ||
      !submissionOpen ||
      !challenge.practiceAvailable ||
      isSolved ||
      submitting ||
      !flag.trim()
    )
      return
    const request = requests.capture()
    if (!request) return
    const submittedFlag = flag
    const celebration = celebrations.capture({
      userId: request.userId,
      mode: request.mode,
      eventId:
        request.mode === 'event'
          ? `club:${request.archiveId}`
          : request.archiveId,
      challengeId: request.challengeId,
      title: challenge.name,
    })
    submitting = true
    feedback = ''
    success = false
    try {
      const args = {
        id: request.archiveId,
        challengeId: request.challengeId,
        flag: submittedFlag,
      }
      const response =
        request.mode === 'event'
          ? await apiRequest(SubmitClubEventRouteV2, args)
          : await apiRequest(SubmitClubPracticeRouteV2, args)
      if (!requests.isCurrent(request)) return
      if (
        response.kind !== GoodClubPractice.kind &&
        response.kind !== GoodClubEventSubmit.kind
      ) {
        if (response.kind === BadRateLimit.kind) {
          const seconds = Math.max(1, Math.ceil(response.data.timeLeft / 1000))
          feedback = `Too many attempts. Try again in ${seconds} second${seconds === 1 ? '' : 's'}.`
        } else feedback = response.message
        if (response.kind === 'badPerms' || response.kind === 'badToken')
          void access.refetch()
        return
      }
      success = response.data.result !== 'incorrect'
      feedback =
        response.data.result === 'correct'
          ? request.mode === 'event'
            ? 'Correct flag. Event solve saved.'
            : 'Correct flag. Practice solve saved.'
          : response.data.result === 'alreadySolved'
            ? request.mode === 'event'
              ? 'You have already solved this challenge.'
              : 'You have already solved this challenge in practice.'
            : 'Incorrect flag. Try again.'
      if (!success) return
      flag = ''
      confirmedSolved = true
      if (response.data.result === 'correct') {
        if (response.kind === GoodClubEventSubmit.kind)
          celebrations.acceptClubEvent(celebration, response)
        else celebrations.acceptPractice(celebration, response)
      }
      const detailKey =
        request.mode === 'event'
          ? clubEventQueryKeys.event(request.archiveId)
          : clubQueryKeys.archive(request.archiveId)
      const listKey =
        request.mode === 'event'
          ? clubEventQueryKeys.events
          : clubQueryKeys.archives
      // Never recreate a cleared session cache or update another event mode.
      queryClient.setQueryData<{ id: string; solvedIds: string[] }>(
        detailKey,
        current => {
          if (
            !requests.isCurrent(request) ||
            !current ||
            current.id !== request.archiveId ||
            current.solvedIds.includes(request.challengeId)
          )
            return current
          return {
            ...current,
            solvedIds: [...current.solvedIds, request.challengeId],
          }
        }
      )
      if (!requests.isCurrent(request)) return
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: detailKey,
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: listKey,
          exact: true,
        }),
      ])
    } catch {
      if (requests.isCurrent(request))
        feedback = 'The flag could not be checked. Please try again.'
    } finally {
      if (requests.isCurrent(request)) submitting = false
    }
  }
</script>

<section
  class="archive-detail"
  aria-label={mode === 'event'
    ? 'Event challenge details'
    : 'Archived challenge details'}
>
  {#if authorized}
    <ClubDetailGeometry seed={challenge.id} category={challenge.category} />
    <header>
      {#if onClose}
        <div class="back-action">
          <Button variant="ghost" size="sm" onclick={onClose}
            >← Challenges</Button
          >
        </div>
      {/if}
      <div class="heading-row">
        <div class="heading-main">
          <span class="category" data-category-color={category.color}
            ><category.icon />{category.name}</span
          >
          <h2>{challenge.name}</h2>
          <p class="metadata">
            {#if challenge.author}By {challenge.author} ·
            {/if}{challenge.solves.toLocaleString()} event solves
          </p>
        </div>
        <div class="event-points">
          <strong>{challenge.points.toLocaleString()}</strong><span
            >Event points</span
          >
        </div>
      </div>
      {#if challenge.tags.length}
        <div class="tags" aria-label="Challenge tags">
          {#each challenge.tags as tag}<span>{tag}</span>{/each}
        </div>
      {/if}
    </header>
    <div class="detail-scroll">
      <Markdown content={challenge.description} />
      {#if challenge.files.length}
        <div class="files">
          <h3>Challenge files</h3>
          {#each challenge.files as file}
            <a href={file.url} target="_blank" rel="noopener noreferrer"
              ><span class="file-name">↓ {file.name}</span><span
                class="file-size"
                >{file.size === null
                  ? 'Download'
                  : `${Math.max(1, Math.round(file.size / 1024))} KB`}</span
              ></a
            >
          {/each}
        </div>
      {/if}
    </div>
    <footer>
      {#if !challenge.practiceAvailable}
        <p class="unavailable">
          <strong>Reference only</strong>{challenge.practiceUnavailableReason ??
            (mode === 'event'
              ? 'Submissions are unavailable for this challenge.'
              : 'This challenge cannot be replayed in archived practice.')}
        </p>
      {:else if isSolved}
        <p class="solved">
          <IconCheck /><span
            >{mode === 'event' ? 'Solved' : 'Solved in practice'}</span
          >
        </p>
      {:else if !submissionOpen}
        <p class="unavailable" role="status">{closedMessage}</p>
      {:else}
        <form onsubmit={submitFlag}>
          <label class="sr-only" for={`${id}-flag`}>Flag</label>
          <Input
            id={`${id}-flag`}
            bind:value={flag}
            disabled={submitting || !submissionOpen}
            placeholder="Enter flag"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            maxlength={10000}
            aria-invalid={(!!feedback && !success) || undefined}
            aria-describedby={feedback ? `${id}-feedback` : undefined}
            required
          />
          <button
            class="submit"
            type="submit"
            disabled={submitting || !submissionOpen || !flag.trim()}
            aria-label={submitting ? 'Checking flag' : 'Submit flag'}
            title="Submit flag"
            >{#if submitting}<Spinner />{:else}<IconPaperPlaneTilt
              />{/if}</button
          >
        </form>
      {/if}
      {#if feedback}<p
          id={`${id}-feedback`}
          class="feedback"
          class:success
          role="status"
        >
          {feedback}
        </p>{/if}
      <p class="practice-note">
        {mode === 'event'
          ? "Solves count toward this event's scoreboard."
          : 'Practice solves are saved separately from event scores.'}
      </p>
    </footer>
  {:else}
    <p class="access-notice" role="status">
      Member access is required to view this challenge.
    </p>
  {/if}
</section>

<style>
  .archive-detail {
    position: relative;
    isolation: isolate;
    display: flex;
    flex-direction: column;
    inline-size: 100%;
    block-size: 100%;
    min-inline-size: 0;
    min-block-size: 0;
    overflow: hidden;
  }

  header {
    flex-shrink: 0;
    max-block-size: 40%;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
    border-block-end: 1px solid var(--club-border);
  }

  .back-action {
    margin: -0.5rem -0.5rem 0.5rem;
  }

  .heading-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .heading-main {
    flex: 1;
    min-inline-size: 0;
  }

  .category {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    max-inline-size: 100%;
    color: var(--category-foreground-l1);
    font-family: var(--font-mono);
    font-size: 0.65rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }

  .category :global(svg) {
    flex-shrink: 0;
    inline-size: 1em;
    block-size: 1em;
  }

  h2 {
    margin-block: 0.45rem;
    color: var(--foreground-l0);
    font-family: var(--font-display);
    font-size: clamp(1.65rem, 3vw, 2.625rem);
    font-style: italic;
    font-weight: 800;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  .metadata {
    color: var(--club-muted);
    font-size: 0.7rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .event-points {
    display: flex;
    flex-shrink: 0;
    flex-direction: column;
    gap: 0.35rem;
    align-items: flex-end;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  .event-points strong {
    color: var(--club-accent-text);
    font-size: 1.25rem;
    font-weight: 500;
  }

  .event-points span {
    color: var(--club-muted);
    font-size: 0.55rem;
    text-transform: uppercase;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-block-start: 0.75rem;
  }

  .tags span {
    max-inline-size: 100%;
    padding: 0.2rem 0.4rem;
    color: var(--club-muted);
    background: var(--club-panel-raised);
    border-radius: var(--radius-sm);
    font-size: 0.65rem;
    overflow-wrap: anywhere;
  }

  .detail-scroll {
    flex: 1;
    min-block-size: 0;
    min-inline-size: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 1.25rem 1.5rem;
    font-size: 0.8125rem;
    line-height: 1.85;
    overflow-wrap: anywhere;
  }

  .detail-scroll :global(prose-content) {
    font-size: inherit;
    line-height: inherit;
  }

  .files {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-block-start: 1.5rem;
  }

  .files h3 {
    color: var(--club-muted);
    font-size: 0.7rem;
    font-weight: 500;
  }

  .files a {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.65rem 0.75rem;
    color: var(--foreground-l1);
    border: 1px solid var(--club-border);
    border-radius: var(--radius-sm);
    text-decoration: none;
  }

  .files a:hover {
    border-color: var(--club-accent-text);
  }

  .file-name {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }

  .file-size {
    flex-shrink: 0;
    color: var(--club-muted);
    font-size: 0.65rem;
    white-space: nowrap;
  }

  footer {
    flex-shrink: 0;
    padding: 1rem 1.5rem;
    background: var(--club-panel-raised);
    border-block-start: 1px solid var(--club-border);
  }

  form {
    display: flex;
    align-items: stretch;
    gap: 0.5rem;
  }

  form :global(input) {
    flex: 1;
    min-inline-size: 0;
    block-size: 3rem;
    font-family: var(--font-mono);
    font-size: 0.95rem;
    border-radius: var(--radius-lg);
  }

  .submit {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    inline-size: 3rem;
    block-size: 3rem;
    color: var(--foreground-accent);
    background: var(--background-accent);
    border-radius: var(--radius-lg);
    cursor: pointer;
  }

  .submit:hover:enabled {
    background: var(--background-accent-hover);
  }

  .submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .submit:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  .submit :global(svg),
  .solved :global(svg) {
    flex-shrink: 0;
    inline-size: 1.5rem;
    block-size: 1.5rem;
  }

  .solved {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-block-size: 3rem;
    color: var(--club-accent-text);
    font-size: 0.9rem;
  }

  .unavailable {
    color: var(--club-muted);
    font-size: 0.8rem;
    line-height: 1.6;
  }

  .unavailable strong {
    display: block;
    color: var(--foreground-l1);
    font-weight: 500;
  }

  .feedback {
    margin-block-start: 0.5rem;
    color: var(--foreground-destructive);
    font-size: 0.75rem;
    overflow-wrap: anywhere;
  }

  .feedback.success {
    color: var(--club-accent-text);
  }

  .practice-note {
    margin-block-start: 0.6rem;
    color: var(--club-muted);
    font-size: 0.65rem;
    line-height: 1.5;
  }

  .access-notice {
    margin: auto;
    padding: 1.5rem;
    color: var(--club-muted);
  }

  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  @media (width < 40rem) {
    header,
    .detail-scroll,
    footer {
      padding-inline: 1rem;
    }

    .heading-row {
      gap: 0.5rem;
    }

    .event-points strong {
      font-size: 1rem;
    }
  }
</style>
