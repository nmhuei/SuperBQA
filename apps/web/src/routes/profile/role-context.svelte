<script lang="ts">
  import type {
    ClientConfig,
    GoodClubAccess,
    ResponseData,
    UserProfile,
  } from '@rctf/types'
  import { profileAccess } from '$lib/club/profile-model'
  import {
    PROMINENT_CTF_CATEGORIES,
    findResumeEvent,
    formatCategoryPercentage,
    formatProgressCount,
    formatProgressPercentage,
    type ProminentCtfCategory,
  } from '$lib/club/team-progress-model'
  import { useClubTeamProgress } from '$lib/query/club-events'
  import Button from '$lib/ui/button.svelte'
  import Spinner from '$lib/ui/spinner.svelte'

  let {
    user,
    clientConfig,
    access,
    accessError = false,
    onRetryAccess,
  }: {
    user: UserProfile
    clientConfig: ClientConfig
    access?: ResponseData<typeof GoodClubAccess>
    accessError?: boolean
    onRetryAccess: () => void
  } = $props()

  const profile = $derived(profileAccess(user.perms, access))
  const isMember = $derived(access?.role === 'member')
  const progressQuery = useClubTeamProgress(() => access?.role === 'member')
  const progress = $derived(
    access?.role === 'member' && !progressQuery.isError
      ? progressQuery.data
      : undefined
  )
  const resumeEvent = $derived(
    progress?.events ? findResumeEvent(progress.events) : null
  )
  const activeCategories = $derived(
    progress?.categories
      ? progress.categories
          .filter(c => c.total > 0)
          .sort((a, b) => {
            const indexA = PROMINENT_CTF_CATEGORIES.indexOf(
              a.category as ProminentCtfCategory
            )
            const indexB = PROMINENT_CTF_CATEGORIES.indexOf(
              b.category as ProminentCtfCategory
            )
            const posA = indexA === -1 ? 999 : indexA
            const posB = indexB === -1 ? 999 : indexB
            return posA - posB
          })
      : []
  )
</script>

{#if accessError}
  <section class="role-panel access-status" aria-label="Club access">
    <p role="alert">Club access could not be checked.</p>
    <Button variant="outline" size="sm" onclick={onRetryAccess}
      >Try again</Button
    >
  </section>
{:else if !access}
  <section
    class="role-panel access-status"
    aria-label="Club access"
    aria-busy="true"
  >
    <Spinner />
    <p>Checking club access…</p>
  </section>
{:else if profile.variant === 'admin'}
  <section
    class="role-panel"
    data-role="admin"
    aria-labelledby="profile-permissions-title"
  >
    <h2 id="profile-permissions-title">Assigned permissions</h2>
    <ul class="permissions">
      {#each profile.permissions as permission (permission.value)}
        <li><span aria-hidden="true">✓</span>{permission.label}</li>
      {/each}
    </ul>
    {#if profile.actions.length}
      <nav class="management-links" aria-label="Your management tools">
        {#each profile.actions as action (action.href)}
          <a href={action.href}
            >{action.label}<span aria-hidden="true">↗</span></a
          >
        {/each}
      </nav>
    {/if}
  </section>
{:else if profile.variant === 'guest'}
  <section class="role-panel" data-role="guest" aria-label="Your public event">
    <span class="eyebrow">Public event</span>
    <h2 class="event-name">{clientConfig.ctfName}</h2>
    <a class="text-link" href="/challenges"
      >View event <span aria-hidden="true">→</span></a
    >
  </section>
{/if}

{#if isMember}
  <section
    class="role-panel"
    data-role="member"
    aria-labelledby="profile-team-progress-title"
  >
    <div class="panel-header">
      <h2 id="profile-team-progress-title">Your team progress</h2>
    </div>

    {#if progressQuery.isError}
      <div class="status-box error-status" role="alert">
        <p>Team progress could not be loaded.</p>
        <Button
          variant="outline"
          size="sm"
          onclick={() => progressQuery.refetch()}
        >
          Try again
        </Button>
      </div>
    {:else if progressQuery.isLoading || !progress}
      <div class="progress-loading" aria-busy="true">
        <Spinner />
        <p>Loading team progress…</p>
      </div>
    {:else if progress.totalChallenges === 0}
      <p class="empty-state">No club event challenges are available yet.</p>
    {:else}
      <div class="total-progress-section">
        <div class="progress-headline">
          <div class="progress-count">
            <strong>{progress.totalSolved}</strong>
            <span>/ {progress.totalChallenges} solved</span>
          </div>
          <span class="percentage-badge">
            {formatProgressPercentage(progress.percentage)}
          </span>
        </div>
        <div class="progress-bar-wrap">
          <progress
            value={progress.totalSolved}
            max={progress.totalChallenges}
            aria-label="Overall team progress"
          ></progress>
        </div>
      </div>

      {#if activeCategories.length > 0}
        <div class="categories-section" aria-label="Category breakdown">
          <h3 class="categories-heading">Category breakdown</h3>
          <ul class="categories-list">
            {#each activeCategories as cat (cat.category)}
              <li class="category-item">
                <div class="category-header">
                  <span class="category-badge">{cat.category}</span>
                  <span class="category-solved">
                    {formatProgressCount(cat.solved, cat.total)}
                  </span>
                  <span class="category-pct">
                    {formatCategoryPercentage(cat.solved, cat.total)}
                  </span>
                </div>
                <div class="mini-progress-bar-wrap">
                  <progress
                    class="mini-progress"
                    value={cat.solved}
                    max={cat.total}
                    aria-label="{cat.category} progress"
                  ></progress>
                </div>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    {/if}

    {#if resumeEvent}
      <a class="resume-link" href="/challenges?event={resumeEvent.id}">
        <span>
          <span class="resume-sub">Continue event:</span>
          <strong>{resumeEvent.name}</strong>
        </span>
        <span class="arrow-glyph" aria-hidden="true">→</span>
      </a>
    {/if}

    <nav class="club-links" aria-label="Member activities">
      <a href="/club/events">Club events <span aria-hidden="true">↗</span></a>
    </nav>
  </section>
{/if}

<style>
  .role-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-inline-size: 0;
    padding: 1.25rem;
    border: 1px solid var(--club-border);
    border-radius: var(--radius-md);
    background: var(--club-panel);
    font-family: var(--font-sans);
  }
  .role-panel[data-role='admin'],
  .role-panel[data-role='member'] {
    border-block-start: 3px solid var(--club-accent-text);
    background: linear-gradient(
      145deg,
      var(--club-accent-soft),
      var(--club-panel) 70%
    );
  }
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  h2 {
    margin: 0;
    color: var(--foreground-l0);
    font-family: var(--font-sans);
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0.02em;
  }
  p {
    margin: 0;
    color: var(--club-muted);
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    line-height: 1.65;
  }
  .eyebrow {
    color: var(--club-muted);
    font-size: 0.6875rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }
  .event-name {
    font-family: var(--font-display);
    font-size: 1.6rem;
    font-weight: 700;
    font-style: italic;
    overflow-wrap: anywhere;
  }
  .permissions {
    display: grid;
    gap: 0.6rem;
    padding: 0;
    list-style: none;
  }
  .permissions li {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    color: var(--foreground-l2);
    font-size: 0.8125rem;
  }
  .permissions li > span {
    color: var(--club-accent-text);
  }
  .management-links {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    border-block-start: 1px solid var(--club-border);
    padding-block-start: 1rem;
  }
  .management-links a {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.65rem 0.7rem;
    background: var(--club-panel);
    border: 1px solid var(--club-border);
    border-radius: var(--radius-sm);
    color: var(--foreground-l1);
    font-size: 0.75rem;
    text-decoration: none;
  }
  .management-links a:hover {
    border-color: var(--club-accent-text);
  }
  .status-box {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  .empty-state {
    color: var(--club-muted);
    font-size: 0.8125rem;
  }
  .total-progress-section {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }
  .progress-headline {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .progress-count {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    color: var(--club-muted);
  }
  .progress-count strong {
    color: var(--club-accent-text);
    font-family: var(--font-sans);
    font-size: 2.25rem;
    font-weight: 700;
    line-height: 1;
  }
  .progress-count > span {
    font-family: var(--font-sans);
    font-size: 0.85rem;
  }
  .percentage-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.2rem 0.55rem;
    background: var(--club-accent-soft);
    border: 1px solid var(--club-border);
    border-radius: var(--radius-sm);
    color: var(--club-accent-text);
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 700;
    line-height: 1.2;
  }
  .progress-bar-wrap,
  .mini-progress-bar-wrap {
    inline-size: 100%;
  }
  progress {
    appearance: none;
    inline-size: 100%;
    block-size: 0.45rem;
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
  .categories-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-block-start: 1px solid var(--club-border);
    padding-block-start: 0.85rem;
  }
  .categories-heading {
    margin: 0;
    color: var(--club-muted);
    font-family: var(--font-sans);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .categories-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
    gap: 0.5rem;
    padding: 0;
    margin: 0;
    list-style: none;
  }
  .category-item {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.55rem 0.7rem;
    background: var(--club-panel);
    border: 1px solid var(--club-border);
    border-radius: var(--radius-sm);
  }
  .category-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem;
    font-size: 0.75rem;
  }
  .category-badge {
    color: var(--club-accent-text);
    font-family: var(--font-sans);
    font-weight: 600;
    letter-spacing: 0.03em;
  }
  .category-solved {
    color: var(--club-muted);
    font-family: var(--font-sans);
    font-size: 0.72rem;
  }
  .category-pct {
    color: var(--foreground-l1);
    font-family: var(--font-sans);
    font-weight: 600;
    font-size: 0.72rem;
  }
  .mini-progress {
    block-size: 0.25rem;
  }
  .resume-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-block-start: 1px solid var(--club-border);
    padding-block-start: 0.85rem;
    color: var(--club-accent-text);
    font-family: var(--font-sans);
    font-size: 0.75rem;
    text-decoration: none;
  }
  .resume-link > span:first-child {
    display: flex;
    align-items: baseline;
    gap: 0.45rem;
    min-inline-size: 0;
    flex-wrap: wrap;
  }
  .resume-sub {
    color: var(--club-muted);
    font-size: 0.75rem;
  }
  .resume-link strong {
    color: var(--foreground-l0);
    font-size: 0.875rem;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .arrow-glyph {
    color: var(--club-accent-text);
    font-size: 0.95rem;
    font-weight: 600;
    transition: transform 0.15s ease;
  }
  .resume-link:hover .arrow-glyph {
    transform: translateX(3px);
  }
  .club-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.25rem;
  }
  .club-links a,
  .text-link {
    align-self: flex-start;
    color: var(--club-accent-text);
    font-family: var(--font-sans);
    font-size: 0.75rem;
    text-decoration: none;
  }
  .club-links a:hover,
  .text-link:hover,
  .resume-link:hover strong {
    text-decoration: underline;
  }
  a:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 3px;
  }
  .access-status,
  .progress-loading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  @media (width < 32rem) {
    .role-panel {
      padding: 1rem;
    }
    .categories-list {
      grid-template-columns: 1fr;
    }
  }
</style>
