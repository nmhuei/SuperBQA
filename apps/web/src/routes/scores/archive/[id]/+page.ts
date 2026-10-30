import { redirect } from '@sveltejs/kit'
import type { PageLoad } from './$types'

export const load: PageLoad = ({ params, url }) => {
  const target = new URL('/scores', url.origin)
  target.searchParams.set('event', params.id)
  for (const [key, val] of url.searchParams.entries()) {
    if (key !== 'event') target.searchParams.set(key, val)
  }
  throw redirect(302, `${target.pathname}${target.search}`)
}
