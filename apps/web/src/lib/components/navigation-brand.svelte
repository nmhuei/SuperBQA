<script lang="ts">
  import { useClientConfig } from '$lib/query/config'

  const configQuery = useClientConfig()
  const clientConfig = $derived(configQuery.data)
  const name = 'UCS'
  const lightLogo = $derived(
    clientConfig?.logoLightUrl || clientConfig?.logoDarkUrl
  )
  const darkLogo = $derived(
    clientConfig?.logoDarkUrl || clientConfig?.logoLightUrl
  )
</script>

<a class="club-brand" href="/" aria-label="{name} home">
  {#if lightLogo || darkLogo}
    <logo-light data-theme-visible="light">
      <img src={lightLogo} alt={name} />
    </logo-light>
    <logo-dark data-theme-visible="dark">
      <img src={darkLogo} alt={name} />
    </logo-dark>
  {:else}
    <brand-mark aria-hidden="true">U<span>/</span></brand-mark>
    <brand-copy>
      <brand-name>{name}</brand-name>
      <brand-tagline>Cybersecurity club</brand-tagline>
    </brand-copy>
  {/if}
</a>

<style>
  .club-brand {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.625rem;
    min-inline-size: 0;
    max-inline-size: calc(100vw - 7rem);
    color: var(--foreground-l0);
    text-decoration: none;
  }

  img {
    display: block;
    block-size: 3.25rem;
    max-inline-size: min(18rem, 55vw);
    object-fit: contain;
    transition: transform 0.2s ease, filter 0.2s ease;
  }

  .club-brand:hover img {
    filter: drop-shadow(0 0 12px rgba(0, 255, 102, 0.5));
    transform: scale(1.02);
  }

  brand-mark {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    position: relative;
    inline-size: 2.5rem;
    block-size: 2.5rem;
    padding-inline-end: 0.125rem;
    color: var(--club-ink);
    background: var(--club-lime);
    clip-path: polygon(0 0, 100% 0, 100% 75%, 75% 100%, 0 100%);
    font-family: var(--font-display);
    font-size: 2.625rem;
    font-style: italic;
    font-weight: 800;
    line-height: 1;

    span {
      position: absolute;
      inset-inline-end: 0.375rem;
      inset-block-start: 0.3125rem;
      font-size: 1.75rem;
    }
  }

  brand-copy {
    display: flex;
    flex-direction: column;
    gap: 0.3125rem;
    min-inline-size: 0;
  }

  brand-name {
    display: block;
    max-inline-size: 12rem;
    overflow: hidden;
    font-family: var(--font-display);
    font-size: 1.625rem;
    font-style: italic;
    font-weight: 800;
    line-height: 1;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  brand-tagline {
    font-size: 0.625rem;
    font-weight: 450;
    letter-spacing: 0.025em;
    color: var(--foreground-l3);
    white-space: nowrap;
  }

  @media (width >= 56rem) and (width < 80rem) {
    brand-name {
      max-inline-size: 9rem;
    }
  }
</style>
