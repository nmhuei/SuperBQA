import { redirect } from '@sveltejs/kit'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ url }) => {
  if (url.searchParams.has('archive')) {
    const archiveParam = url.searchParams.get('archive')?.trim()
    if (archiveParam) {
      const nextUrl = new URL(url)
      nextUrl.searchParams.delete('archive')
      nextUrl.searchParams.set('event', archiveParam)
      throw redirect(
        302,
        `${nextUrl.pathname}?${nextUrl.searchParams.toString()}${nextUrl.hash}`
      )
    }
    throw redirect(302, '/club/events')
  }
  if (url.searchParams.has('event')) return
  throw redirect(302, '/club/events')
}
