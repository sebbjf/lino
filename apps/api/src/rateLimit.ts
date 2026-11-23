// ponytail: in-memory fixed window per IP, one process only; move to Redis or the proxy if the API scales out.
export function rateLimit(max: number, windowMs: number) {
  const hits = new Map<string, { n: number; reset: number }>()
  return (ip: string) => {
    const now = Date.now()
    const h = hits.get(ip)
    if (!h || h.reset < now) {
      // drop finished windows first, so filling the map does not reset everyone's count
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k)
      if (hits.size > 10_000) hits.clear()
      hits.set(ip, { n: 1, reset: now + windowMs })
      return false
    }
    return ++h.n > max
  }
}
