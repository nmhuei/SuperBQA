<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import ClubEventAdmin from '$lib/components/club-event-admin.svelte'

  onMount(() => {
    void goto('/club/events?manage=true', { replaceState: true })
  })
</script>

<ClubEventAdmin />
