<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import ClubCatalog from '$lib/components/club-catalog.svelte'
  import ClubEventAdmin from '$lib/components/club-event-admin.svelte'
  import { useClubAccess } from '$lib/query/club'
  import { useCurrentUser } from '$lib/query/user'
  import Spinner from '$lib/ui/spinner.svelte'

  const access = useClubAccess()
  const user = useCurrentUser()

  const isAuthenticatedUser = $derived(!!user.data && !user.isError)
  const canManage = $derived(
    isAuthenticatedUser &&
      access.data?.canManageArchives === true &&
      !access.isError
  )

  const hasManage = $derived(page.url.searchParams.has('manage'))
  const hasCreate = $derived(page.url.searchParams.has('create'))
  const manageParam = $derived(page.url.searchParams.get('manage'))
  const initialEventId = $derived(
    manageParam && manageParam !== 'true' ? manageParam : undefined
  )
  const isCreateMode = $derived(hasCreate)

  function handleBack() {
    void goto('/club/events')
  }
</script>

{#if (hasManage || hasCreate) && (access.isPending || user.isPending)}
  <div class="status-loading" role="status">
    <Spinner />
    <p>Checking permissions…</p>
  </div>
{:else if canManage && (hasManage || hasCreate)}
  <ClubEventAdmin
    {initialEventId}
    {isCreateMode}
    onBack={handleBack}
  />
{:else}
  <ClubCatalog kind="events" {canManage} />
{/if}

<style>
  .status-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 3rem 1rem;
    color: var(--club-muted);
    min-block-size: calc(100dvh - var(--header-height));
  }
</style>
