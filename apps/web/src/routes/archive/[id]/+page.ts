import { redirect } from '@sveltejs/kit'
import { clubEventChallengeHref } from '$lib/club/club-event-model'
import { parseArchiveLocation } from '$lib/club/archive-model'
import type { PageLoad } from './$types'

export const load: PageLoad = ({ params, url }) => {
  const id = params.id
  if (id) {
    throw redirect(302, clubEventChallengeHref(id, parseArchiveLocation(url)))
  }
  throw redirect(302, '/club/events')
}
