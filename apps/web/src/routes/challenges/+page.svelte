<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import ArchiveWorkspace from '$lib/components/archive-workspace.svelte'
  import { parseClubEventLocation } from '$lib/club/club-event-model'
  import LivePage from './live-page.svelte'

  const eventId = $derived(
    parseClubEventLocation(page.url).eventId ??
      page.url.searchParams.get('archive')?.trim() ??
      ''
  )
  const eventRoute = $derived(
    page.url.searchParams.has('event') || page.url.searchParams.has('archive')
  )

  $effect(() => {
    if (page.url.searchParams.has('archive')) {
      const archiveParam = page.url.searchParams.get('archive')?.trim()
      if (archiveParam) {
        const nextUrl = new URL(page.url)
        nextUrl.searchParams.delete('archive')
        nextUrl.searchParams.set('event', archiveParam)
        void goto(
          `${nextUrl.pathname}?${nextUrl.searchParams.toString()}${nextUrl.hash}`,
          { replaceState: true }
        )
      } else {
        void goto('/club/events', { replaceState: true })
      }
    }
  })
</script>

{#if eventRoute}
  {#key eventId}<ArchiveWorkspace archiveId={eventId} mode="event" />{/key}
{:else}
  <LivePage />
{/if}
