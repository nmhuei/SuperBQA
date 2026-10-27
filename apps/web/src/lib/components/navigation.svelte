<script lang="ts">
  import { useQueryClient } from '@tanstack/svelte-query'
  import { mergeProps } from '@zag-js/svelte'
  import NavigationBrand from '$lib/components/navigation-brand.svelte'
  import NavigationButton from '$lib/components/navigation-button.svelte'
  import NavigationCountdown from '$lib/components/navigation-countdown.svelte'
  import NavigationMobile from '$lib/components/navigation-mobile.svelte'
  import {
    IconCopy,
    IconFlagBannerFold,
    IconGavel,
    IconGear,
    IconGlobeHemisphereWest,
    IconHouse,
    IconInfo,
    IconSignIn,
    IconSignOut,
    IconTableFilled,
    IconUserGear,
  } from '$lib/icons'
  import { getNavigationModel } from '$lib/club/navigation-model'
  import { useClubAccess } from '$lib/query/club'
  import { useClientConfig } from '$lib/query/config'
  import { useCurrentUser } from '$lib/query/user'
  import Avatar from '$lib/ui/avatar.svelte'
  import Menu from '$lib/ui/menu.svelte'
  import Tooltip from '$lib/ui/tooltip.svelte'
  import { copyLoginUrl, logout } from '$lib/utils/auth'
  import { createRovingFocus } from '$lib/utils/roving'

  const rovingFocus = createRovingFocus()

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
  const adminMenuItems = $derived(
    navigation.admin.map(item => ({
      value: item.id,
      label: item.label,
      href: item.href,
      icon: icons[item.icon],
    }))
  )

  const userMenuItems = $derived([
    {
      value: 'copy-login-url',
      label: 'Copy login URL',
      icon: IconCopy,
      onSelect: () => {
        if (user?.teamToken) copyLoginUrl(user.teamToken)
      },
    },
    {
      value: 'profile',
      label: 'Account',
      icon: IconUserGear,
      href: '/profile',
    },
    {
      value: 'logout',
      label: 'Log out',
      icon: IconSignOut,
      onSelect: () => logout(queryClient),
    },
  ])
</script>

<header class="club-header">
  <nav-toolbar>
    <nav-start>
      <NavigationBrand />
      <nav aria-label="Main" {@attach rovingFocus}>
        {#each navigation.main as item (item.id)}
          <Tooltip label={item.label}>
            {#snippet children({ props })}
              <NavigationButton
                {...props}
                data-roving
                href={item.href}
                activePath={item.href}
                label={item.label}
                icon={icons[item.icon]}
              />
            {/snippet}
          </Tooltip>
        {/each}
        {#if adminMenuItems.length}
          <Tooltip label="Admin">
            {#snippet children({ props: tooltipProps })}
              <Menu label="Admin menu" items={adminMenuItems}>
                {#snippet trigger({ props: menuProps })}
                  <NavigationButton
                    {...mergeProps(tooltipProps, menuProps)}
                    data-roving
                    activePath="/admin"
                    label="Admin menu"
                    icon={IconGavel}
                  />
                {/snippet}
              </Menu>
            {/snippet}
          </Tooltip>
        {/if}
      </nav>
    </nav-start>

    <nav-end>
      <NavigationCountdown />
      {#if user && !isArchived}
        {@const currentUser = user}
        <Menu label="Account" items={userMenuItems} placement="bottom-end">
          {#snippet trigger({ props })}
            <button {...props}>
              <user-details>
                <user-name>{currentUser.name}</user-name>
              </user-details>
              <Avatar src={currentUser.avatarUrl} name={currentUser.name} />
            </button>
          {/snippet}
        </Menu>
      {:else if !isArchived}
        <Tooltip label="Login">
          {#snippet children({ props })}
            <NavigationButton
              {...props}
              href="/login"
              label="Login"
              icon={IconSignIn}
            />
          {/snippet}
        </Tooltip>
      {/if}
    </nav-end>

    <NavigationMobile />
  </nav-toolbar>

  {#if user?.banned}
    <div class="banned-alert-banner">
      <span class="banned-alert-icon">⛔</span>
      <span class="banned-alert-text">
        Your team has been banned. If you have any questions, please open a ticket on our Discord server.
      </span>
    </div>
  {/if}
</header>

<style>
  .banned-alert-banner {
    background: rgba(230, 25, 60, 0.96);
    color: #ffffff;
    padding: 0.55rem 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    font-size: 0.875rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    border-bottom: 2px solid #ff4466;
    box-shadow: 0 4px 16px rgba(255, 0, 50, 0.4);
    text-align: center;
    z-index: 1000;
  }

  .banned-alert-icon {
    font-size: 1.1rem;
  }
  header {
    position: fixed;
    inset-block-start: 0;
    inset-inline: 0;
    z-index: var(--layer-nav);
    display: flex;
    flex-direction: column;
    block-size: var(--header-height);
    background: var(--background-l0);
  }

  nav-toolbar {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    min-block-size: 0;
    padding-inline: clamp(1rem, 3.2vw, 3.5rem);
  }

  nav-start {
    display: flex;
    align-items: center;
    gap: clamp(1rem, 2.5vw, 2.5rem);
    min-inline-size: 0;
  }

  nav,
  nav-end {
    display: none;
    align-items: center;
    gap: 0.375rem;

    @media (width >= 56rem) {
      display: flex;
    }
  }

  nav-end {
    flex-shrink: 0;
  }

  [data-scope='menu'][data-part='trigger'] {
    --avatar-size: 1.875rem;

    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.25rem 0.25rem 0.25rem 0.75rem;
    cursor: pointer;
    border: 1px solid var(--club-border);
    border-radius: var(--radius-lg);

    &:hover {
      background: var(--background-l2);
    }
  }

  user-details {
    display: flex;
    flex-direction: column;
    align-items: end;
  }

  user-name {
    display: block;
    max-inline-size: 8rem;
    overflow: hidden;
    font-size: 0.875rem;
    font-weight: 650;
    line-height: 1.25;
    color: var(--foreground-l0);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
