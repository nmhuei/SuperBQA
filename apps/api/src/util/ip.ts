import proxyAddr from '@fastify/proxy-addr'
import { config } from '@rctf/config'
import type { Context } from 'hono'
import { getConnInfo } from 'hono/bun'

// NOTE(es3n1n): We could've used something more elegant,
//   but unfortunately we need backwards compatibility with rctf v1.

function compile(
  value: boolean | string | string[] | number
): (ip: string, i: number) => boolean {
  if (typeof value === 'boolean') {
    return (_ip: string, _i: number) => value
  }
  if (typeof value === 'number') {
    return (_ip: string, i: number) => i < value
  }
  if (typeof value === 'string') {
    return proxyAddr.compile((value as string).split(',').map(it => it.trim()))
  }
  return proxyAddr.compile(value as string[])
}

const trust = compile(config.proxy.trust)

function getForwardedFor(ctx: Context, remoteIp: string | undefined): string[] {
  const header = ctx.req.header('x-forwarded-for')
  let result: string[] = remoteIp ? [remoteIp] : []
  if (!header) {
    return result
  }

  let end = header.length
  let start = header.length

  for (var i = header.length - 1; i >= 0; i--) {
    switch (header.charCodeAt(i)) {
      case 0x20 /*   */:
        if (start === end) {
          start = end = i
        }
        break
      case 0x2c /* , */:
        if (start !== end) {
          result.push(header.substring(start, end))
        }

        start = end = i
        break
      default:
        start = i
        break
    }
  }

  if (start !== end) {
    result.push(header.substring(start, end))
  }

  return result
}

const isCloudflareOrInternal = proxyAddr.compile([
  'loopback',
  'linklocal',
  'uniquelocal',
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
])

export function getIp(ctx: Context): string {
  const rawIp = getConnInfo(ctx).remote.address
  if (!rawIp) {
    throw new Error('Could not determine remote IP address')
  }

  let remoteIp = rawIp
  // FIXME(es3n1n): is there a better way?
  if (remoteIp?.startsWith('::ffff:')) {
    remoteIp = remoteIp.slice(7)
  }

  if (config.proxy.cloudflare) {
    const cfIp = ctx.req.header('cf-connecting-ip')
    // Only trust cf-connecting-ip if the request came through Cloudflare edge or an internal reverse proxy
    if (cfIp && isCloudflareOrInternal(remoteIp, 0)) {
      return cfIp
    }
    return remoteIp
  }

  const forwardedFor = getForwardedFor(ctx, remoteIp)
  for (let i = 0; i < forwardedFor.length; i++) {
    if (trust(forwardedFor[i]!, i)) {
      continue
    }

    forwardedFor.length = i + 1
  }

  return forwardedFor.length ? forwardedFor[forwardedFor.length - 1]! : remoteIp
}
