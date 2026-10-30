<script lang="ts">
  import { page } from '$app/state'
  import { isNavigationPathActive } from '$lib/club/archive-model'
  import { IconCaretDown } from '$lib/icons'
  import type { Component } from 'svelte'

  type Props = {
    href?: string
    activePath?: string
    label: string
    icon?: Component
    hasDropdown?: boolean
    [key: string]: unknown
  }

  let {
    href,
    activePath,
    label,
    icon: _Icon,
    hasDropdown = false,
    ...rest
  }: Props = $props()

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
    <span class="nav-label">
      {label === 'Admin menu' ? 'Admin' : label}
      {#if hasDropdown}
        <span class="nav-caret"><IconCaretDown /></span>
      {/if}
    </span>
  </a>
{:else}
  <button
    type="button"
    aria-label={label}
    data-active={active ? '' : undefined}
    {...rest}
  >
    <span class="nav-label">
      {label === 'Admin menu' ? 'Admin' : label}
      {#if hasDropdown}
        <span class="nav-caret"><IconCaretDown /></span>
      {/if}
    </span>
  </button>
{/if}

<style>
  a,
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    min-block-size: 2.75rem;
    padding: 0.625rem 0.875rem;
    font-size: 0.9375rem;
    font-weight: 600;
    flex-shrink: 0;
    white-space: nowrap;
    border: 1px solid transparent;
    color: var(--foreground-l2);
    background: transparent;
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, padding 0.25s ease;

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
      font-size: 0.85rem;
    }
  }

  .nav-label {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    white-space: nowrap;
  }

  .nav-caret {
    display: inline-flex;
    align-items: center;
    margin-inline-start: 0.15rem;
    font-size: 0.75rem;
    opacity: 0.8;
    vertical-align: middle;
    transition: transform 0.2s ease;
  }

  :global([data-state='open']) .nav-caret,
  :global([aria-expanded='true']) .nav-caret {
    transform: rotate(180deg);
  }

  a[href='/login'] {
    color: var(--foreground-l0);
    border-color: var(--club-border);
  }

  a[href='/login'] .nav-label {
    max-inline-size: 12rem;
    opacity: 1;
    transform: scaleX(1);
  }
</style>
