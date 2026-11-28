export const isOffline = () => globalThis.navigator?.onLine === false

export class ConnectionNeeded extends Error {}

export async function fetchApi(url: string, offlineMessage: string, init?: RequestInit) {
  if (isOffline()) throw new ConnectionNeeded(offlineMessage)
  try {
    return await fetch(url, init)
  } catch (error) {
    // Fetch rejects with TypeError when the network request fails.
    if (error instanceof TypeError) throw new ConnectionNeeded(offlineMessage)
    throw error
  }
}
