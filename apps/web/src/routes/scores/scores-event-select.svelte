<script lang="ts">
  import * as menu from '@zag-js/menu'
  import { normalizeProps, useMachine } from '@zag-js/svelte'
  import { clubEventPhase, prioritizeClubEvents } from '$lib/club/club-event-model'
  import { IconCaretDown, IconCheck, IconSearch } from '$lib/icons'
  import Portal from '$lib/ui/portal.svelte'

  export interface ClubEventItem {
    id: string
    name: string
    startTime: number
    endTime: number
    published: boolean
    clubOnly?: boolean
  }

  interface Props {
    events: ClubEventItem[]
    selectedEventId: string | null
    now: number
    onselect: (id: string) => void
  }

  let { events, selectedEventId, now, onselect }: Props = $props()

  const id = $props.id()
  let searchQuery = $state('')

  const prioritized = $derived(prioritizeClubEvents(events, now))

  const filteredEvents = $derived.by(() => {
    if (!searchQuery.trim()) return prioritized
    const q = searchQuery.toLowerCase().trim()
    return prioritized.filter(e => e.name.toLowerCase().includes(q))
  })

  const selectedEvent = $derived(
    events.find(e => e.id === selectedEventId) ?? prioritized[0] ?? null
  )

  const selectedPhase = $derived(
    selectedEvent ? clubEventPhase(selectedEvent, now) : null
  )

  const service = useMachine(menu.machine, () => ({
    id,
    'aria-label': 'Select event',
    positioning: { placement: 'bottom-start' as const, gutter: 6 },
    onSelect({ value }: { value: string }) {
      onselect(value)
    },
  }))
  const api = $derived(menu.connect(service, normalizeProps))

  const triggerProps = $derived(
    api.getTriggerProps() as Record<string, unknown>
  )
</script>

<div class="scores-event-dropdown">
  <button
    type="button"
    class="event-select-trigger"
    class:is-open={api.open}
    {...triggerProps}
  >
    {#if selectedEvent}
      <span class="event-name">{selectedEvent.name}</span>
      {#if selectedEvent.clubOnly}
        <span class="tab-tag club-tag">Club Only</span>
      {/if}
      {#if selectedPhase}
        <span class="tab-phase phase-{selectedPhase}">
          {#if selectedPhase === 'live'}
            <span class="pulse-dot"></span>
          {/if}
          {selectedPhase.toUpperCase()}
        </span>
      {/if}
    {:else}
      <span class="event-placeholder">Select event</span>
    {/if}
    <span class="select-caret" class:is-rotated={api.open}>
      <IconCaretDown />
    </span>
  </button>
</div>

<Portal>
  <div {...api.getPositionerProps()}>
    <div {...api.getContentProps()} class="event-select-content">
      {#if events.length > 5}
        <div class="event-search-box">
          <IconSearch class="search-icon" />
          <input
            type="text"
            class="event-search-input"
            placeholder="Search event..."
            bind:value={searchQuery}
            onclick={e => e.stopPropagation()}
            onkeydown={e => e.stopPropagation()}
          />
        </div>
      {/if}

      <div class="events-list">
        {#each filteredEvents as item (item.id)}
          {@const phase = clubEventPhase(item, now)}
          {@const isSelected = item.id === selectedEventId}
          <div
            {...api.getItemProps({ value: item.id })}
            class="event-menu-item"
            class:is-active={isSelected}
            onclick={() => onselect(item.id)}
          >
            <div class="item-main">
              {#if phase === 'live'}
                <span class="pulse-dot"></span>
              {/if}
              <span class="item-name">{item.name}</span>
              {#if item.clubOnly}
                <span class="tab-tag club-tag">Club Only</span>
              {/if}
              <span class="tab-phase phase-{phase}">
                {phase.toUpperCase()}
              </span>
            </div>

            {#if isSelected}
              <span class="item-check" aria-hidden="true">
                <IconCheck />
              </span>
            {/if}
          </div>
        {:else}
          <div class="no-events-found">No matching events</div>
        {/each}
      </div>
    </div>
  </div>
</Portal>

<style>
  .scores-event-dropdown {
    display: inline-flex;
    align-items: center;
  }

  .event-select-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.85rem;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--club-lime, #00f076);
    background: color-mix(in srgb, var(--club-lime) 12%, var(--background-l1));
    border: 2px solid var(--club-lime, #00f076);
    border-radius: var(--radius-md);
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 0 10px rgba(0, 240, 118, 0.25);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .event-select-trigger:hover,
  .event-select-trigger.is-open {
    background: color-mix(in srgb, var(--club-lime) 20%, var(--background-l1));
    box-shadow: 0 0 16px rgba(0, 240, 118, 0.4);
  }

  .event-name {
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .event-placeholder {
    color: var(--foreground-l2);
  }

  .select-caret {
    display: inline-flex;
    align-items: center;
    font-size: 0.85rem;
    color: var(--club-lime, #00f076);
    opacity: 0.9;
    margin-inline-start: 0.25rem;
    transition: transform 0.2s ease;
  }

  .select-caret.is-rotated {
    transform: rotate(180deg);
  }

  .tab-tag {
    font-size: 0.625rem;
    font-weight: 700;
    padding: 0.1rem 0.35rem;
    border-radius: var(--radius-sm);
    text-transform: uppercase;
  }

  .club-tag {
    background: rgba(0, 229, 255, 0.15);
    color: #00e5ff;
    border: 1px solid rgba(0, 229, 255, 0.35);
  }

  .tab-phase {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    opacity: 0.85;
  }

  .phase-live {
    color: var(--club-lime, #00f076);
  }

  .phase-ended {
    color: var(--foreground-l3);
  }

  .phase-upcoming {
    color: #ffb400;
  }

  .phase-draft {
    color: var(--foreground-l4);
  }

  .pulse-dot {
    display: inline-block;
    inline-size: 0.45rem;
    block-size: 0.45rem;
    border-radius: 50%;
    background: var(--club-lime, #00f076);
    box-shadow: 0 0 6px var(--club-lime, #00f076);
    animation: pulseGlow 1.5s infinite ease-in-out;
  }

  @keyframes pulseGlow {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.4;
      transform: scale(0.8);
    }
  }

  .event-select-content {
    z-index: var(--layer-popover);
    display: flex;
    flex-direction: column;
    min-inline-size: 16rem;
    max-inline-size: 24rem;
    max-block-size: 22rem;
    background: var(--background-l1);
    border: 1px solid var(--club-border);
    border-radius: var(--radius-md);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 14px rgba(0, 240, 118, 0.15);
    padding: 0.35rem;
    outline: none;
    font-family: inherit;
  }

  .event-search-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.6rem;
    margin-block-end: 0.35rem;
    background: var(--background-l2);
    border: 1px solid var(--club-border);
    border-radius: var(--radius-sm);
  }

  :global(.event-search-box .search-icon) {
    font-size: 0.85rem;
    color: var(--foreground-l3);
    flex-shrink: 0;
  }

  .event-search-input {
    flex: 1;
    min-inline-size: 0;
    background: transparent;
    border: none;
    outline: none;
    font-family: inherit;
    font-size: 0.8125rem;
    color: var(--foreground-l0);
  }

  .events-list {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    overflow-y: auto;
    overscroll-behavior: none;
  }

  .event-menu-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.5rem 0.65rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--foreground-l1);
    font-size: 0.875rem;
    transition: background 0.12s ease;
  }

  .event-menu-item[data-highlighted],
  .event-menu-item:hover {
    background: var(--background-l2);
    color: var(--foreground-l0);
  }

  .event-menu-item.is-active {
    color: var(--club-lime, #00f076);
    background: color-mix(in srgb, var(--club-lime) 10%, var(--background-l1));
  }

  .item-main {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-inline-size: 0;
    flex-wrap: wrap;
  }

  .item-name {
    font-weight: 600;
  }

  .item-check {
    display: inline-flex;
    align-items: center;
    color: var(--club-lime, #00f076);
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  .no-events-found {
    padding: 0.75rem;
    text-align: center;
    font-size: 0.8125rem;
    color: var(--foreground-l3);
  }
</style>
