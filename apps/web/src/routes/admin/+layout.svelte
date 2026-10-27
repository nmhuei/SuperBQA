<script lang="ts">
  import { browser } from '$app/environment'
  import { goto } from '$app/navigation'
  import { IconWarningCircle } from '$lib/icons'
  import { useClientConfig } from '$lib/query/config'
  import { useCurrentUser } from '$lib/query/user'
  import Button from '$lib/ui/button.svelte'
  import Spinner from '$lib/ui/spinner.svelte'
  import StatusCard from '$lib/ui/status-card.svelte'
  import type { LayoutProps } from './$types'
  import { decideAdminGate } from './admin-gate'

  const { children }: LayoutProps = $props()

  const userQuery = useCurrentUser()
  const configQuery = useClientConfig()

  const ctfName = $derived(configQuery.data?.ctfName)
  const isPending = $derived(userQuery.isLoading || configQuery.isLoading)
  const gate = $derived(decideAdminGate(userQuery.data))

  // Immediately kick unauthorized users back to home
  $effect(() => {
    if (browser && !isPending && gate !== 'ok') {
      void goto('/', { replaceState: true })
    }
  })
</script>

<svelte:head>
  {#if ctfName}
    <title>Admin | {ctfName}</title>
  {/if}
</svelte:head>

{#if isPending}
  <admin-status>
    <Spinner />
  </admin-status>
{:else if gate !== 'ok'}
  <admin-status>
    <StatusCard
      icon={IconWarningCircle}
      title="Access Denied"
      subtitle="Only authorized administrators are permitted to access this area. Redirecting to home…"
    >
      <Button href="/">Return to Home</Button>
    </StatusCard>
  </admin-status>
{:else}
  {@render children()}
{/if}

<style>
  admin-status {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    padding: var(--space-l);
  }
</style>
