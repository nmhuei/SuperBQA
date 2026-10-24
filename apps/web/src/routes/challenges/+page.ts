import { challengesQueryOptions } from '$lib/query/challenges'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ parent, url }) => {
  if (url.searchParams.has('archive') || url.searchParams.has('event')) return
  const { queryClient } = await parent()
  await queryClient.prefetchQuery(challengesQueryOptions)
}
