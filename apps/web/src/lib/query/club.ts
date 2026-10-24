import {
  GetClubAccessRouteV2,
  GetClubArchivesRouteV2,
  GetClubArchiveRouteV2,
  GetClubMembersRouteV2,
  GoodClubAccess,
  GoodClubArchives,
  GoodClubArchive,
  GoodClubMembers,
} from '@rctf/types'
import { createQuery, queryOptions } from '@tanstack/svelte-query'
import { apiRequest } from '$lib/api'
import { ApiError, unwrapData } from '$lib/query/core'

export const clubQueryKeys = {
  all: ['club'] as const,
  access: ['club', 'access'] as const,
  archives: ['club', 'archives'] as const,
  archive: (id: string) => ['club', 'archive', id] as const,
  members: (search: string, offset: number) =>
    ['club', 'members', search, offset] as const,
}
const retry = (failureCount: number, error: Error) =>
  !(error instanceof ApiError) && failureCount < 2

export const clubAccessQueryOptions = queryOptions({
  queryKey: clubQueryKeys.access,
  queryFn: async () =>
    unwrapData(await apiRequest(GetClubAccessRouteV2), GoodClubAccess),
  staleTime: 0,
  refetchInterval: 15_000,
  retry,
})

// The existing resetSessionQueries clears every non-config query, including club.
export function useClubAccess() {
  return createQuery(() => clubAccessQueryOptions)
}

export function useClubArchives(enabled: () => boolean) {
  return createQuery(() => ({
    queryKey: clubQueryKeys.archives,
    queryFn: async () =>
      unwrapData(await apiRequest(GetClubArchivesRouteV2), GoodClubArchives),
    enabled: enabled(),
    staleTime: 0,
    retry,
  }))
}

export function useClubArchive(id: () => string, enabled: () => boolean) {
  return createQuery(() => ({
    queryKey: clubQueryKeys.archive(id()),
    queryFn: async () =>
      unwrapData(
        await apiRequest(GetClubArchiveRouteV2, { id: id() }),
        GoodClubArchive
      ),
    enabled: enabled() && !!id(),
    staleTime: 0,
    retry,
  }))
}

export const CLUB_MEMBERS_PAGE_SIZE = 20

export function useClubMembers(
  search: () => string,
  offset: () => number,
  enabled: () => boolean
) {
  return createQuery(() => ({
    queryKey: clubQueryKeys.members(search(), offset()),
    queryFn: async () =>
      unwrapData(
        await apiRequest(GetClubMembersRouteV2, {
          search: search(),
          limit: CLUB_MEMBERS_PAGE_SIZE,
          offset: offset(),
        }),
        GoodClubMembers
      ),
    enabled: enabled(),
    staleTime: 0,
    refetchInterval: 15_000,
    retry,
  }))
}
