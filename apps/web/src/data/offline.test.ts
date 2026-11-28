import { afterEach, expect, test, vi } from 'vitest'
import { addLink } from '../board/link.ts'
import { useBoard } from '../board/store.ts'
import { fetchApi } from './apiConnection.ts'
import { loadShared, shareBoard } from './share.ts'

afterEach(() => {
  vi.unstubAllGlobals()
  useBoard.setState(useBoard.getInitialState())
})

test.each([false, true])('keeps a bare link when onLine is %s and the API is unreachable', async (onLine) => {
  const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
  vi.stubGlobal('navigator', { onLine })
  vi.stubGlobal('fetch', fetch)
  const url = 'https://example.com/'

  await addLink(url, { x: 0, y: 0 })

  const { elements, notice } = useBoard.getState()
  expect(elements).toMatchObject([{ type: 'link', url, status: 'ok', title: null, image: null, fonts: [], colors: [] }])
  expect(notice).toBe('Offline: the link was added without a preview.')
  expect(fetch).toHaveBeenCalledTimes(onLine ? 1 : 0)
})

test('sharing and opening shared boards explain that they need a connection', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('navigator', { onLine: false })
  vi.stubGlobal('fetch', fetch)

  await expect(shareBoard()).rejects.toThrow('Sharing needs a connection.')
  await expect(loadShared('example')).rejects.toThrow('Opening a shared board needs a connection.')
  expect(fetch).not.toHaveBeenCalled()
})

test('opening a shared board distinguishes a failed fetch from an HTTP error', async () => {
  vi.stubGlobal('navigator', { onLine: true })
  vi.stubGlobal('fetch', vi.fn()
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce(Response.json({ error: 'Board not found.' }, { status: 404 })))

  await expect(loadShared('example')).rejects.toThrow('Opening a shared board needs a connection.')
  await expect(loadShared('example')).rejects.toThrow('Board not found.')
})

test('a failed upload fetch reports the sharing connection notice even when onLine is true', async () => {
  vi.stubGlobal('navigator', { onLine: true })
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

  await expect(shareBoard()).rejects.toThrow('Sharing needs a connection.')
})

test.each([500, 404])('a link reader HTTP %s uses the normal error path without an offline notice', async (status) => {
  const url = 'https://example.com/'
  const error = 'Could not read that page.'
  vi.stubGlobal('navigator', { onLine: true })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error }, { status })))

  await addLink(url, { x: 0, y: 0 })

  expect(useBoard.getState().elements).toMatchObject([{ type: 'link', url, status: 'error', error }])
  expect(useBoard.getState().notice).toBeNull()
})

test('a share HTTP 500 preserves the server message', async () => {
  vi.stubGlobal('navigator', { onLine: true })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'Share store failed.' }, { status: 500 })))

  await expect(shareBoard()).rejects.toThrow('Share store failed.')
})

test('fetchApi rethrows AbortError unchanged', async () => {
  const error = new DOMException('Request canceled.', 'AbortError')
  vi.stubGlobal('navigator', { onLine: true })
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error))

  await expect(fetchApi('/api/read', 'A connection is required.')).rejects.toBe(error)
})
