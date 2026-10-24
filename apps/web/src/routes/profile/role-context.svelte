<script lang="ts">
  import type {
    ClientConfig,
    GoodClubAccess,
    ResponseData,
    UserProfile,
  } from '@rctf/types'
  import { archiveChallengeHref } from '$lib/club/archive-model'
  import { profileAccess, profilePractice } from '$lib/club/profile-model'
  import { useClubArchives } from '$lib/query/club'
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
  const showPractice = $derived(
    !accessError && access?.role === 'member' && access.canAccessArchives
  )
  const archivesQuery = useClubArchives(() => !!showPractice)
  const archives = $derived(
    showPractice && !archivesQuery.isError ? archivesQuery.data : undefined
  )
  const practice = $derived(archives ? profilePractice(archives) : null)
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

{#if showPractice}
  <section
    class="role-panel"
    data-role="member"
    aria-labelledby="profile-practice-title"
  >
    <h2 id="profile-practice-title">Practice</h2>
    {#if archivesQuery.isError}
      <p role="alert">Practice progress could not be loaded.</p>
      <Button
        variant="outline"
        size="sm"
        onclick={() => archivesQuery.refetch()}>Try again</Button
      >
    {:else if !practice}
      <div class="progress-loading" aria-busy="true">
        <Spinner />
        <p>Loading progress…</p>
      </div>
    {:else if practice.totals && practice.totals.total > 0}
      <div class="progress-count">
        <strong>{practice.totals.solved}</strong><span
          >/ {practice.totals.total} solved</span
        >
      </div>
      <progress
        value={practice.totals.solved}
        max={practice.totals.total}
        aria-label="Archived practice challenges solved"
      ></progress>
    {:else if practice.totals}
      <p>No practice challenges are available yet.</p>
    {:else}
      <p>Progress is not available for every archive yet.</p>
    {/if}
    {#if practice?.next}
      <a class="resume-link" href={archiveChallengeHref(practice.next.id)}>
        <span
          >{practice.next.solvedCount
            ? 'Continue practice'
            : 'Start practice'}<strong>{practice.next.name}</strong></span
        >
        <span aria-hidden="true">→</span>
      </a>
    {/if}
    <nav class="club-links" aria-label="Member activities">
      <a href="/archive">All archives ↗</a><a href="/club/events"
        >Club events ↗</a
      >
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
  h2 {
    margin: 0;
    color: var(--foreground-l0);
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.4;
  }
  p {
    color: var(--club-muted);
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
  .progress-count {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    color: var(--club-muted);
  }
  .progress-count strong {
    color: var(--club-accent-text);
    font-family: var(--font-display);
    font-size: 2.5rem;
    font-weight: 700;
    line-height: 1;
  }
  .progress-count > span {
    font-size: 0.8125rem;
  }
  progress {
    appearance: none;
    inline-size: 100%;
    block-size: 0.35rem;
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
  .resume-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-block-start: 1px solid var(--club-border);
    padding-block-start: 1rem;
    color: var(--club-accent-text);
    font-size: 0.75rem;
    text-decoration: none;
  }
  .resume-link > span:first-child {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    min-inline-size: 0;
  }
  .resume-link strong {
    color: var(--foreground-l0);
    font-size: 0.9rem;
    font-weight: 500;
    overflow-wrap: anywhere;
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
    align-items: flex-start;
    gap: 0.75rem;
  }
  .progress-loading {
    align-items: center;
  }
  @media (width < 32rem) {
    .role-panel {
      padding: 1rem;
    }
  }
</style>
