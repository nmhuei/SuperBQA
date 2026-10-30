<script lang="ts">
  import { useQueryClient } from '@tanstack/svelte-query'
  import { mergeProps } from '@zag-js/svelte'
  import { afterNavigate } from '$app/navigation'
  import { page } from '$app/state'
  import { isNavigationPathActive } from '$lib/club/archive-model'
  import NavigationBrand from '$lib/components/navigation-brand.svelte'
  import {
    IconCopy,
    IconFlagBannerFold,
    IconGear,
    IconGlobeHemisphereWest,
    IconHouse,
    IconInfo,
    IconMenu2,
    IconSignIn,
    IconSignOut,
    IconTableFilled,
    IconUserGear,
    IconX,
  } from '$lib/icons'
  import { getNavigationModel } from '$lib/club/navigation-model'
  import { useClubAccess } from '$lib/query/club'
  import { useClientConfig } from '$lib/query/config'
  import { useCurrentUser } from '$lib/query/user'
  import Dialog from '$lib/ui/dialog.svelte'
  import Tooltip from '$lib/ui/tooltip.svelte'
  import { copyLoginUrl, logout } from '$lib/utils/auth'

  const queryClient = useQueryClient()
  const configQuery = useClientConfig()
  const clientConfig = $derived(configQuery.data)
  const userQuery = useCurrentUser()
  const user = $derived(userQuery.data)

  const isArchived = $derived(clientConfig?.isArchived ?? false)
  const accessQuery = useClubAccess()
  const navigation = $derived(
    getNavigationModel({
      mode: clientConfig?.clubMode,
      user,
      access: accessQuery.data,
      userError: userQuery.isError,
      accessError: accessQuery.isError,
    })
  )
  const icons = {
    home: IconHouse,
    rules: IconInfo,
    challenges: IconFlagBannerFold,
    scores: IconGlobeHemisphereWest,
    archive: IconTableFilled,
    account: IconUserGear,
    settings: IconGear,
  }

  let open = $state(false)

  afterNavigate(() => {
    open = false
  })

  const navItems = $derived(
    [
      ...navigation.main,
      ...navigation.admin,
      ...(user && !isArchived
        ? [
            {
              id: 'account',
              href: '/profile',
              label: 'Account',
              icon: 'account' as const,
            },
          ]
        : []),
    ].map(item => ({ ...item, activePath: item.href, icon: icons[item.icon] }))
  )

  const isActive = (activePath: string) =>
    isNavigationPathActive(activePath, page.url)
</script>

<mobile-nav>
  <Dialog bind:open title="Navigation" titleHidden presentation="sheet">
    {#snippet trigger({ props })}
      <button {...props} aria-label="Open navigation">
        <IconMenu2 />
      </button>
    {/snippet}
    {#snippet children({ closeProps })}
      <sheet-header>
        <NavigationBrand />
        <button {...closeProps} aria-label="Close navigation">
          <IconX />
        </button>
      </sheet-header>
      <nav aria-label="Main">
        {#each navItems as item (item.href)}
          {@const Icon = item.icon}
          <a
            href={item.href}
            data-active={isActive(item.activePath) ? '' : undefined}
            aria-current={isActive(item.activePath) ? 'page' : undefined}
          >
            {item.label}
          </a>
        {/each}
      </nav>
      <sheet-footer>
        {#if user && !isArchived}
          {@const currentUser = user}
          <footer-actions>
            <Tooltip label="Copy login URL">
              {#snippet children({ props })}
                <button
                  {...mergeProps(props, {
                    onclick: () => {
                      if (currentUser.teamToken)
                        copyLoginUrl(currentUser.teamToken)
                    },
                  })}
                  aria-label="Copy login URL"
                >
                  <IconCopy />
                </button>
              {/snippet}
            </Tooltip>
            <Tooltip label="Log out">
              {#snippet children({ props })}
                <button
                  {...mergeProps(props, { onclick: () => logout(queryClient) })}
                  aria-label="Log out"
                >
                  <IconSignOut />
                </button>
              {/snippet}
            </Tooltip>
          </footer-actions>
        {:else if !isArchived}
          <a href="/login" aria-label="Login">
            <IconSignIn />
            <span>Login</span>
          </a>
        {/if}
      </sheet-footer>
    {/snippet}
  </Dialog>
</mobile-nav>

<style>
  mobile-nav {
    display: block;

    @media (width >= 56rem) {
      display: none;
    }
  }

  button,
  sheet-footer a {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-block-size: 2.75rem;
    padding: 0.625rem 0.75rem;
    font-size: 1.25rem;
    border: 1px solid var(--club-border);
    color: var(--foreground-l2);
    background: var(--background-l2);
    border-radius: var(--radius-lg);
    cursor: pointer;

    &:hover {
      background: var(--background-l3);
    }

    &:focus-visible {
      outline-offset: 0;
    }
  }

  sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2xs);

    padding-block-end: 1rem;
    border-block-end: 1px solid var(--club-border);
  }

  nav {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--space-3xs);

    a {
      display: flex;
      align-items: center;
      gap: var(--space-2xs);
      min-block-size: 3.25rem;
      padding: var(--space-2xs) var(--space-xs);
      font-size: 1rem;
      font-weight: 550;
      border: 1px solid transparent;
      color: var(--foreground-l1);
      text-decoration: none;
      border-radius: var(--radius-lg);

      &:hover {
        background: var(--background-l2);
      }

      &:focus-visible {
        outline-offset: 0;
      }

      &[data-active] {
        color: var(--club-accent-text);
        background: var(--club-accent-soft);
      }

      :global(svg) {
        flex-shrink: 0;
        font-size: 1.25rem;
      }
    }
  }

  sheet-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2xs);
  }

  footer-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2xs);
  }
</style>
