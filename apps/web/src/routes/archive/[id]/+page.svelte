<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import {
    archiveChallengeHref,
    parseArchiveLocation,
  } from '$lib/club/archive-model'
  import Button from '$lib/ui/button.svelte'
  const target = $derived(
    archiveChallengeHref(page.params.id ?? '', parseArchiveLocation(page.url))
  )
  $effect(() => {
    void goto(target, { replaceState: true })
  })
</script>

<div role="status"><Button href={target}>Open archived challenges</Button></div>
