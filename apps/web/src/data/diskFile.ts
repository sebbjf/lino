import type { DiskHandle } from './fileLink.ts'

type PickerOptions = {
  types: { description: string; accept: Record<string, string[]> }[]
  excludeAcceptAllOption: boolean
}

type DiskWindow = Window & {
  showOpenFilePicker(options: PickerOptions): Promise<DiskHandle[]>
  showSaveFilePicker(options: PickerOptions & { suggestedName: string }): Promise<DiskHandle>
}

const options: PickerOptions = {
  types: [{ description: 'Lino board', accept: { 'application/json': ['.lino.json'] } }],
  excludeAcceptAllOption: true,
}

const diskWindow = () => window as Window as DiskWindow

export async function pickDiskFile() {
  const [handle] = await diskWindow().showOpenFilePicker(options)
  return handle
}

export function pickDiskTarget(suggestedName: string) {
  return diskWindow().showSaveFilePicker({ ...options, suggestedName })
}

export async function requestWrite(handle: DiskHandle) {
  const access = { mode: 'readwrite' } as const
  if (await handle.queryPermission(access) === 'granted') return true
  return await handle.requestPermission(access) === 'granted'
}

export async function writeDiskFile(handle: DiskHandle, body: string) {
  const writable = await handle.createWritable()
  try {
    await writable.write(body)
    await writable.close()
  } catch (e) {
    await writable.abort().catch(() => {})
    throw e
  }
  return (await handle.getFile()).lastModified
}
