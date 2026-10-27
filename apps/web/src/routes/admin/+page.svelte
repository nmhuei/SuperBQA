<script lang="ts">
  import { browser } from '$app/environment'
  import { goto } from '$app/navigation'
  import { useCurrentUser } from '$lib/query/user'
  import { decideAdminGate } from './admin-gate'

  const userQuery = useCurrentUser()
  const isPending = $derived(userQuery.isLoading)
  const gate = $derived(decideAdminGate(userQuery.data))

  $effect(() => {
    if (browser && !isPending) {
      if (gate === 'ok') {
        void goto('/admin/challenges', { replaceState: true })
      } else {
        void goto('/', { replaceState: true })
      }
    }
  })
</script>
