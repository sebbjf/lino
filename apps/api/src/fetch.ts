import dns from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'

/** Thrown for URLs we refuse to fetch (bad scheme, internal address, ...). The message is safe to show. */
export class BlockedError extends Error {}

// Everything that is not a public unicast address. IPv4-mapped IPv6 (::ffff:a.b.c.d) is checked against the IPv4 rules.
const blocked = new net.BlockList()
for (const [net4, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3], // multicast, reserved and broadcast
] as const)
  blocked.addSubnet(net4, prefix, 'ipv4')
for (const [net6, prefix] of [
  ['::', 127], // unspecified and loopback
  ['64:ff9b::', 96], // NAT64
  ['100::', 64],
  ['2001::', 23], // IETF protocol assignments (Teredo, ...)
  ['2001:db8::', 32],
  ['2002::', 16], // 6to4 can embed any IPv4
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const)
  blocked.addSubnet(net6, prefix, 'ipv6')

export function isBlockedIp(ip: string) {
  const family = net.isIP(ip)
  if (!family) return true
  return blocked.check(ip, family === 4 ? 'ipv4' : 'ipv6')
}

/**
 * DNS lookup that refuses internal addresses. The socket connects to the address checked here,
 * so a hostname cannot pass the check and then re-resolve to 127.0.0.1 (DNS rebinding).
 */
export const safeLookup: net.LookupFunction = (hostname, options, cb) => {
  dns.lookup(hostname, { all: true }, (err, addrs) => {
    if (err) return cb(err, '', 0)
    if (!addrs.length || addrs.some((a) => isBlockedIp(a.address)))
      return cb(new BlockedError('That address is not allowed.'), '', 0)
    if (options.all) (cb as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, addrs)
    else cb(null, addrs[0].address, addrs[0].family)
  })
}

/** Throws BlockedError unless the URL is http(s) on a default port with a public host. */
export function checkUrl(raw: string | URL): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new BlockedError('That is not a valid URL.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new BlockedError('Only http and https links work.')
  if (url.username || url.password) throw new BlockedError('Links with credentials are not allowed.')
  if (url.port && url.port !== '80' && url.port !== '443') throw new BlockedError('Only the default ports are allowed.')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  // IP literals skip DNS, so the lookup guard never sees them
  if (net.isIP(host) && isBlockedIp(host)) throw new BlockedError('That address is not allowed.')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) throw new BlockedError('That address is not allowed.')
  return url
}

export type Fetched = { url: URL; type: string; body: Buffer }
export type FetchOpts = { maxBytes: number; accept: string; signal: AbortSignal }
export type Fetcher = (url: URL, opts: FetchOpts) => Promise<Fetched>

const MAX_REDIRECTS = 3

/** GET with the SSRF guard on every hop, a size cap and an abort signal. Non-2xx responses throw. */
export async function safeFetch(start: URL, opts: FetchOpts): Promise<Fetched> {
  let url = checkUrl(start)
  for (let hop = 0; ; hop++) {
    const res = await request(url, opts)
    if (res.status >= 300 && res.status < 400 && res.location) {
      if (hop === MAX_REDIRECTS) throw new Error('Too many redirects.')
      url = checkUrl(new URL(res.location, url))
      continue
    }
    if (res.status < 200 || res.status >= 300) throw new Error(`The page answered ${res.status}.`)
    return { url, type: res.type, body: res.body }
  }
}

function request(url: URL, { maxBytes, accept, signal }: FetchOpts) {
  return new Promise<{ status: number; location?: string; type: string; body: Buffer }>((resolve, reject) => {
    const req = (url.protocol === 'https:' ? https : http).get(
      url,
      { lookup: safeLookup, signal, headers: { accept, 'user-agent': 'LinoBot/0.1 (+moodboard link preview)' } },
      (res) => {
        const status = res.statusCode ?? 0
        const type = res.headers['content-type'] ?? ''
        if (status >= 300 && status < 400) {
          res.resume()
          return resolve({ status, location: res.headers.location, type, body: Buffer.alloc(0) })
        }
        if (Number(res.headers['content-length']) > maxBytes) {
          res.destroy()
          return reject(new Error('The response is too large.'))
        }
        const chunks: Buffer[] = []
        let size = 0
        res.on('data', (c: Buffer) => {
          size += c.length
          if (size > maxBytes) {
            res.destroy()
            reject(new Error('The response is too large.'))
          } else chunks.push(c)
        })
        res.on('end', () => resolve({ status, type, body: Buffer.concat(chunks) }))
        res.on('error', reject)
      },
    )
    req.on('error', reject)
  })
}
