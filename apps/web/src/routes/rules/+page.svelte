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
    align-items: center;
    inline-size: 100%;
    block-size: calc(100dvh - var(--header-height));
    min-block-size: 0;
    padding: 2rem 1.5rem;
  }
  .rules-content {
    flex: 1;
    inline-size: 100%;
    max-inline-size: 85ch;
    margin-inline: auto;
    min-block-size: 0;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    padding-inline: 1rem;
    padding-block-end: 4rem;
  }
  .rules-content:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 3px;
  }
  .rules-content :global(prose-content) {
    max-inline-size: 100%;
    margin-inline: auto;
    font-size: 0.95rem;
    line-height: 1.85;
  }
  .rules-content :global(prose-content > h1:first-child) {
    text-align: center;
    font-size: 2.25rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #ffffff;
    margin-bottom: 0.5rem;
  }
  .rules-content :global(prose-content > h1:first-child + p) {
    text-align: center;
    max-inline-size: 65ch;
    margin-inline: auto;
    color: var(--foreground-l2, #b5bfba);
    margin-bottom: 1.5rem;
  }
  .rules-content :global(prose-content [data-timer]) {
    display: none !important;
  }
  .rules-content :global(prose-content > hr) {
    border-color: rgba(0, 255, 102, 0.2);
    margin-block: 2.5rem;
  }
  .rules-content > p {
    color: var(--club-muted);
    font-size: 0.9375rem;
    line-height: 1.7;
    text-align: center;
  }
  @media (width < 40rem) {
    .club-rules {
      padding: 1rem 0.75rem;
    }
  }
</style>
