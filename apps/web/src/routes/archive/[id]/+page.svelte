<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { clubEventChallengeHref } from '$lib/club/club-event-model'
  import { parseArchiveLocation } from '$lib/club/archive-model'
  import Button from '$lib/ui/button.svelte'

  const target = $derived(
    page.params.id
      ? clubEventChallengeHref(page.params.id, parseArchiveLocation(page.url))
      : '/club/events'
  )

  $effect(() => {
    void goto(target, { replaceState: true })
  })
</script>

<div role="status"><Button href={target}>Open challenges</Button></div>
