<script lang="ts">
  import { useClientConfig } from '$lib/query/config'
  import { profileAccess } from '$lib/club/profile-model'
  import { useClubAccess } from '$lib/query/club'
  import { useLeaderboardChallenges } from '$lib/query/leaderboard'
  import { useCurrentUser } from '$lib/query/user'
  import Button from '$lib/ui/button.svelte'
  import Card from '$lib/ui/card.svelte'
  import { toChallengeInfos } from './analytics/analytics-data'
  import ProfileHeader from './profile-header.svelte'
  import ProfileRoleContext from './role-context.svelte'
  import ProfileSettingsAccount from './settings/account.svelte'
  import ProfileSettingsAvatar from './settings/avatar.svelte'
  import ProfileSettingsCtftime from './settings/ctftime.svelte'
  import ProfileSettingsMembers from './settings/members.svelte'
  import ProfileShell from './shell.svelte'
  import ProfileSolves from './solves/solves.svelte'

  const userQuery = useCurrentUser()
  const configQuery = useClientConfig()
  const challengesQuery = useLeaderboardChallenges()
  const accessQuery = useClubAccess()

  const user = $derived(userQuery.data)
  const access = $derived(accessQuery.isError ? undefined : accessQuery.data)
  const profile = $derived(profileAccess(user?.perms, access))
  const clientConfig = $derived(configQuery.data)
  const ctfName = $derived(clientConfig?.ctfName)
  const isLoading = $derived(userQuery.isLoading || configQuery.isLoading)

  const challenges = $derived(toChallengeInfos(challengesQuery.data))

  const tabs = [
    { value: 'settings', label: 'Account' },
    { value: 'challenges', label: 'Solves' },
  ]

  const status = $derived(
    isLoading ? 'loading' : !user || !clientConfig ? 'unavailable' : 'ready'
  )
</script>

<svelte:head>
  {#if ctfName}
    <title>Profile | {ctfName}</title>
  {/if}
</svelte:head>

<ProfileShell {tabs} desktopColumn="settings" compact {status}>
  {#snippet unavailable()}
    <Card title="Profile">
      <p>You need to be logged in to view your profile.</p>
      <Button href="/login">Log in</Button>
    </Card>
  {/snippet}

  {#snippet header()}
    {#if user && clientConfig}
      <ProfileHeader
        {user}
        divisions={clientConfig.divisions}
        role={profile.membership}
        isAdmin={profile.variant === 'admin'}
      />
    {/if}
  {/snippet}

  {#snippet panel(tab: string)}
    {#if user && clientConfig}
      {#if tab === 'challenges'}
        <ProfileSolves
          {challenges}
          solves={user.solves}
          dynamicScores={user.dynamicScores}
          showUnsolved={false}
          ctfStartTime={clientConfig.startTime}
        />
      {:else if tab === 'settings'}
        {#key user.id}
          <div class="account-layout" data-role={profile.variant}>
            <div class="account-fields">
              <ProfileSettingsAccount {user} {clientConfig} />
            </div>
            <div class="account-extras">
              <ProfileRoleContext
                {user}
                {clientConfig}
                {access}
                accessError={accessQuery.isError}
                onRetryAccess={() => accessQuery.refetch()}
              />
              <div class="account-avatar">
                <ProfileSettingsAvatar {user} {clientConfig} />
              </div>
              <ProfileSettingsCtftime {user} {clientConfig} />
              <ProfileSettingsMembers {clientConfig} />
            </div>
          </div>
        {/key}
      {/if}
    {/if}
  {/snippet}
</ProfileShell>

<style>
  .account-layout {
    display: grid;
    inline-size: 100%;
    grid-template-columns: minmax(0, 1.5fr) minmax(18rem, 1fr);
    gap: clamp(1.5rem, 4vw, 4rem);
    padding: 0.25rem 0;
  }

  .account-fields {
    align-self: start;
    padding: 1.25rem;
    border: 1px solid var(--club-border);
    border-radius: var(--radius-md);
    background: var(--club-panel);
  }
  .account-avatar {
    padding-block: 0.25rem;
  }

  .account-fields,
  .account-extras {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    min-inline-size: 0;
  }

  @media (width < 48rem) {
    .account-layout {
      grid-template-columns: minmax(0, 1fr);
      gap: 1.5rem;
    }
    .account-extras {
      grid-row: 1;
    }
    .account-fields {
      padding: 1rem;
    }
  }
</style>
