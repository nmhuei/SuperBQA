<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import Button from '$lib/ui/button.svelte'

  const target = $derived(
    page.url.searchParams.get('q')
      ? `/club/events?q=${encodeURIComponent(page.url.searchParams.get('q') ?? '')}`
      : '/club/events'
  )

  $effect(() => {
    void goto(target, { replaceState: true })
  })
</script>

<div role="status"><Button href={target}>Open club events</Button></div>
