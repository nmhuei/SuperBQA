<script lang="ts">
  import Markdown from '$lib/components/markdown.svelte'
  import { useClientConfig } from '$lib/query/config'
  const configQuery = useClientConfig()
  const config = $derived(configQuery.data)
</script>

<svelte:head><title>Rules | {config?.ctfName ?? 'UCS'}</title></svelte:head>

<section class="club-rules" aria-labelledby="rules-title">
  <h1 id="rules-title" data-visually-hidden>Rules</h1>
  <!-- The reading region is keyboard scrollable. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="rules-content"
    tabindex="0"
    role="region"
    aria-label="Competition rules"
  >
    {#if config?.homeContent.trim()}
      <Markdown content={config.homeContent} />
    {:else}
      <p>The organizers have not published the event rules yet.</p>
    {/if}
  </div>
</section>

<style>
  .club-rules {
    display: flex;
    flex-direction: column;
    inline-size: 100%;
    block-size: calc(100dvh - var(--header-height));
    min-block-size: 0;
    padding: 1rem;
  }
  .rules-content {
    flex: 1;
    min-block-size: 0;
    overflow: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }
  .rules-content:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 3px;
  }
  .rules-content :global(prose-content) {
    max-inline-size: 80ch;
    font-size: 0.9375rem;
    line-height: 1.85;
  }
  .rules-content > p {
    color: var(--club-muted);
    font-size: 0.9375rem;
    line-height: 1.7;
  }
  @media (width < 40rem) {
    .club-rules {
      padding: 0.75rem;
    }
  }
</style>
