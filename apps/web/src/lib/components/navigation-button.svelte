<script lang="ts">
  import { page } from '$app/state'
  import { isNavigationPathActive } from '$lib/club/archive-model'
  import type { Component } from 'svelte'

  type Props = {
    href?: string
    activePath?: string
    label: string
    icon: Component
    [key: string]: unknown
  }

  let { href, activePath, label, icon: Icon, ...rest }: Props = $props()

  const active = $derived.by(() => {
    if (!activePath) return false
    return isNavigationPathActive(activePath, page.url)
  })
</script>

{#if href}
  <a
    {href}
    aria-label={label}
    aria-current={active ? 'page' : undefined}
    data-active={active ? '' : undefined}
    {...rest}
  >
    <Icon />
    <span class="nav-label">{label === 'Admin menu' ? 'Admin' : label}</span>
  </a>
{:else}
  <button
    type="button"
    aria-label={label}
    data-active={active ? '' : undefined}
    {...rest}
  >
    <Icon />
    <span class="nav-label">{label === 'Admin menu' ? 'Admin' : label}</span>
  </button>
{/if}

<style>
  a,
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-block-size: 2.75rem;
    padding: 0.625rem 0.875rem;
    font-size: 0.875rem;
    font-weight: 550;
    border: 1px solid transparent;
    color: var(--foreground-l2);
    background: transparent;
    border-radius: var(--radius-lg);
    cursor: pointer;

    &:hover {
      background: var(--background-l2);
      border-color: var(--club-border);
    }

    &[data-active] {
      color: var(--club-accent-text);
      background: var(--club-accent-soft);

      &:hover {
        background: color-mix(
          in srgb,
          var(--club-lime) 15%,
          var(--background-l1)
        );
      }
    }

    :global(svg) {
      flex-shrink: 0;
      font-size: 1.125rem;
    }
  }

  .nav-label {
    @media (width < 68rem) {
      display: none;
    }
  }

  a[href='/login'] .nav-label {
    display: inline;
  }

  a[href='/login'] {
    color: var(--foreground-l0);
    border-color: var(--club-border);
  }
</style>
