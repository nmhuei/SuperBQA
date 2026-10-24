<script lang="ts">
  import { page } from '$app/state'
  import ArchiveWorkspace from '$lib/components/archive-workspace.svelte'
  import { parseArchiveLocation } from '$lib/club/archive-model'
  import { parseClubEventLocation } from '$lib/club/club-event-model'
  import LivePage from './live-page.svelte'

  const archiveRoute = $derived(page.url.searchParams.has('archive'))
  const archiveId = $derived(parseArchiveLocation(page.url).archiveId ?? '')
  const eventRoute = $derived(
    !archiveRoute && page.url.searchParams.has('event')
  )
  const eventId = $derived(parseClubEventLocation(page.url).eventId ?? '')
</script>

{#if archiveRoute}
  {#key archiveId}<ArchiveWorkspace {archiveId} />{/key}
{:else if eventRoute}
  {#key eventId}<ArchiveWorkspace archiveId={eventId} mode="event" />{/key}
{:else}
  <LivePage />
{/if}
