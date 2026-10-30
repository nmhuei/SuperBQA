import {
  GetClubEventsRouteV2,
  GetClubEventRouteV2,
  GetClubEventSubmissionsRouteV2,
  GetClubTeamProgressRouteV2,
  GoodClubEvents,
  GoodClubEvent,
  GoodClubEventSubmissions,
  GoodClubTeamProgress,
} from '@rctf/types'
import { createQuery } from '@tanstack/svelte-query'
import { apiRequest } from '$lib/api'
import { ApiError, unwrapData } from './core'

export const clubEventQueryKeys = {
  all: ['club', 'events'] as const,
  events: ['club', 'events', 'list'] as const,
  event: (id: string) => ['club', 'events', 'detail', id] as const,
  submissions: (id: string) => ['club', 'events', 'submissions', id] as const,
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
export function useClubEventSubmissions(id: () => string, enabled: () => boolean) {
  return createQuery(() => ({
    queryKey: clubEventQueryKeys.submissions(id()),
    queryFn: async () =>
      unwrapData(
        await apiRequest(GetClubEventSubmissionsRouteV2, { id: id() }),
        GoodClubEventSubmissions
      ),
    enabled: enabled() && !!id(),
    staleTime: 0,
    refetchInterval: 5_000,
    retry,
  }))
}

export function useClubTeamProgress(enabled: () => boolean) {
  return createQuery(() => ({
    queryKey: ['club', 'team-progress'] as const,
    queryFn: async () =>
      unwrapData(
        await apiRequest(GetClubTeamProgressRouteV2),
        GoodClubTeamProgress
      ),
    enabled: enabled(),
    staleTime: 0,
    refetchInterval: 15_000,
    retry,
  }))
}
