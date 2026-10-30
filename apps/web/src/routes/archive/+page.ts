import { redirect } from '@sveltejs/kit'
import type { PageLoad } from './$types'

export const load: PageLoad = ({ url }) => {
  const q = url.searchParams.get('q')
  const target = q ? `/club/events?q=${encodeURIComponent(q)}` : '/club/events'
  throw redirect(302, target)
}
