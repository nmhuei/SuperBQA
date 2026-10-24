<script lang="ts">
  import { page } from '$app/state'
  import { IconQuestion } from '$lib/icons'
  import { useClientConfig } from '$lib/query/config'
  import { useLeaderboardChallenges } from '$lib/query/leaderboard'
  import { useUserById } from '$lib/query/user'
  import Button from '$lib/ui/button.svelte'
  import StatusCard from '$lib/ui/status-card.svelte'
  import { toChallengeInfos } from '../analytics/analytics-data'
  import ProfileHeader from '../profile-header.svelte'
  import ProfileShell from '../shell.svelte'
  import ProfileSolves from '../solves/solves.svelte'

  const userId = $derived(page.params.id ?? '')
  const userQuery = useUserById(() => userId)
  const configQuery = useClientConfig()
  const challengesQuery = useLeaderboardChallenges()

  const user = $derived(userQuery.data)
  const clientConfig = $derived(configQuery.data)
  const ctfName = $derived(clientConfig?.ctfName)

  const challenges = $derived(toChallengeInfos(challengesQuery.data))

  const tabs = [{ value: 'challenges', label: 'Solves' }]

  const status = $derived(
    userQuery.isPending
      ? 'loading'
      : !user || !clientConfig
        ? 'unavailable'
        : 'ready'
  )
</script>

<svelte:head>
  {#if user && ctfName}
    <title>{user.name} | {ctfName}</title>
  {:else if ctfName}
    <title>Profile not found | {ctfName}</title>
  {/if}
</svelte:head>

<ProfileShell {tabs} desktopColumn="analytics" compact {status}>
  {#snippet unavailable()}
    <StatusCard
      icon={IconQuestion}
      title="Profile not found"
      subtitle={userQuery.error?.message ??
        'The requested profile could not be found.'}
    >
      <Button href="/scores">Scoreboard</Button>
    </StatusCard>
  {/snippet}

  {#snippet header()}
    {#if user && clientConfig}
      <ProfileHeader {user} divisions={clientConfig.divisions} />
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
      {/if}
    {/if}
  {/snippet}
</ProfileShell>
