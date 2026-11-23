import { create } from 'zustand'
import type { Pattern } from './style.ts'

// App-wide preferences of this device. Kept apart from the boards (so they never travel in a shared board or a .lino.json)
// and in localStorage, which is synchronous: the theme is applied before the first render, with no flash.

export type Theme = 'system' | 'light' | 'dark'
export type Settings = { theme: Theme; snap: boolean; newPattern: Pattern; newMessy: boolean }
export const DEFAULTS: Settings = { theme: 'system', snap: true, newPattern: 'dots', newMessy: false }

const KEY = 'lino:settings'

/** Reads what is stored, ignoring anything unknown or malformed. */
export function parseSettings(raw: string | null): Settings {
  try {
    const o = JSON.parse(raw ?? '{}') as Partial<Settings>
    return {
      theme: o.theme === 'light' || o.theme === 'dark' ? o.theme : DEFAULTS.theme,
      snap: typeof o.snap === 'boolean' ? o.snap : DEFAULTS.snap,
      newPattern: o.newPattern === 'grid' || o.newPattern === 'plain' ? o.newPattern : DEFAULTS.newPattern,
      newMessy: typeof o.newMessy === 'boolean' ? o.newMessy : DEFAULTS.newMessy,
    }
  } catch {
    return DEFAULTS
  }
}

const load = () => {
  try {
    return parseSettings(localStorage.getItem(KEY))
  } catch {
    return DEFAULTS // storage blocked
  }
}

export const isDark = (theme: Theme, systemDark: boolean) => (theme === 'system' ? systemDark : theme === 'dark')

export const useSettings = create<Settings & { open: boolean }>(() => ({ ...load(), open: false }))

/** Changes a setting and remembers it. */
export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  useSettings.setState({ [key]: value } as Pick<Settings, K>)
  const { theme, snap, newPattern, newMessy } = useSettings.getState()
  try {
    localStorage.setItem(KEY, JSON.stringify({ theme, snap, newPattern, newMessy }))
  } catch {
    // the choice still holds until the tab closes
  }
}

/** Keeps the dark class on <html> in step with the theme and the system setting. */
export function startTheme() {
  const media = matchMedia('(prefers-color-scheme: dark)')
  const apply = () => document.documentElement.classList.toggle('dark', isDark(useSettings.getState().theme, media.matches))
  apply()
  media.addEventListener('change', apply)
  useSettings.subscribe(apply)
}
