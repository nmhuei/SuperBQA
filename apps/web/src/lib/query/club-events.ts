import {
  GetClubEventsRouteV2,
  GetClubEventRouteV2,
  GoodClubEvents,
  GoodClubEvent,
} from '@rctf/types'
import { createQuery } from '@tanstack/svelte-query'
import { apiRequest } from '$lib/api'
import { ApiError, unwrapData } from './core'

export const clubEventQueryKeys = {
  all: ['club', 'events'] as const,
  events: ['club', 'events', 'list'] as const,
  event: (id: string) => ['club', 'events', 'detail', id] as const,
}
const retry = (attempt: number, error: Error) =>
  !(error instanceof ApiError) && attempt < 2
export function useClubEvents(enabled: () => boolean) {
  return createQuery(() => ({
    queryKey: clubEventQueryKeys.events,
    queryFn: async () =>
      unwrapData(await apiRequest(GetClubEventsRouteV2), GoodClubEvents),
    enabled: enabled(),
    staleTime: 0,
    refetchInterval: 15_000,
    retry,
  }))
}
export function useClubEvent(id: () => string, enabled: () => boolean) {
  return createQuery(() => ({
    queryKey: clubEventQueryKeys.event(id()),
    queryFn: async () =>
      unwrapData(
        await apiRequest(GetClubEventRouteV2, { id: id() }),
        GoodClubEvent
      ),
    enabled: enabled() && !!id(),
    staleTime: 0,
    refetchInterval: 10_000,
    retry,
  }))
}
