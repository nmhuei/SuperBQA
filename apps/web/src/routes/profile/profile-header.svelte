<script lang="ts">
  import type { PublicUserProfile, UserProfile } from '@rctf/types'
  import { ALL_REGIONS } from '@rctf/util'
  import Avatar from '$lib/ui/avatar.svelte'
  import { countryCodeToFlagFilename } from '$lib/utils/flags'

  type Props = {
    user: UserProfile | PublicUserProfile
    divisions: Record<string, string>
    role?: 'guest' | 'member'
    isAdmin?: boolean
  }

  let { user, divisions, role, isAdmin = false }: Props = $props()

  const divisionLabel = $derived(divisions[user.division] ?? user.division)
  const flagFilename = $derived(
    user.countryCode ? countryCodeToFlagFilename(user.countryCode) : null
  )
  const countryName = $derived(
    user.countryCode
      ? (ALL_REGIONS.find(r => r.code === user.countryCode)?.name ?? null)
      : null
  )
</script>

<profile-header>
  <header-layout>
    <profile-identity>
      <profile-avatar>
        {#key user.avatarUrl}
          <Avatar src={user.avatarUrl} name={user.name} />
        {/key}
      </profile-avatar>

      <profile-body>
        <div class="identity-line">
          <profile-name>{user.name}</profile-name>
          {#if role}<span
              class="role"
              data-role={role}
              aria-label="Club membership: {role === 'member'
                ? 'Member'
                : 'Guest'}">{role === 'member' ? 'Member' : 'Guest'}</span
            >{/if}
          {#if isAdmin}<span class="role admin-role">Admin</span>{/if}
        </div>

        <dl>
          <dt>Division</dt>
          <dd>{divisionLabel}</dd>

          {#if flagFilename && countryName}
            <dt>Country</dt>
            <dd data-value="country">
              <img src="/flags/{flagFilename}" alt="{user.countryCode} flag" />
              <span>{countryName}</span>
            </dd>
          {/if}

          {#if user.statusText}
            <dt>Status</dt>
            <dd>{user.statusText}</dd>
          {/if}

          {#if user.ctftimeId}
            <dt>CTFtime</dt>
            <dd>
              <a
                href="https://ctftime.org/team/{user.ctftimeId}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Team #{user.ctftimeId}
              </a>
            </dd>
          {/if}
        </dl>
      </profile-body>
    </profile-identity>
  </header-layout>
</profile-header>

<style>
  profile-header {
    container-type: inline-size;
    display: block;
  }

  header-layout {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  profile-identity {
    display: flex;
    min-inline-size: 0;
    gap: var(--space-xs);
  }

  profile-avatar {
    display: contents;

    --avatar-size: 3.25rem;
  }

  profile-body {
    display: flex;
    min-inline-size: 0;
    flex-direction: column;
    gap: 0.375rem;
  }

  profile-name {
    overflow: hidden;
    color: var(--foreground-l0);
    font-size: var(--step-1);
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }

  .identity-line {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.6rem;
  }

  .role {
    padding: 0.2rem 0.4rem;
    color: var(--club-accent-text);
    background: var(--club-accent-soft);
    font-size: 0.65rem;
    border-radius: var(--radius-sm);
  }

  .role[data-role='guest'] {
    color: var(--club-muted);
    background: var(--background-l3);
  }
  .admin-role {
    color: var(--club-ink);
    background: var(--club-lime);
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.125rem var(--space-s);
    margin: 0;
    font-size: var(--step--1);

    dt {
      color: var(--foreground-l4);
    }

    dd {
      min-inline-size: 0;
      margin: 0;
      overflow: hidden;
      color: var(--foreground-l2);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    dd[data-value='country'] {
      display: flex;
      align-items: center;
      gap: var(--space-3xs);

      img {
        block-size: 1rem;
        inline-size: auto;
        flex-shrink: 0;
      }
    }

    a {
      color: var(--foreground-prose-link);

      &:hover {
        text-decoration: underline;
      }
    }
  }

  @container (min-inline-size: 30rem) {
    header-layout {
      flex-direction: row;
      align-items: flex-start;
      justify-content: space-between;
    }
  }
</style>
