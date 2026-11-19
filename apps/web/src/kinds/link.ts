import { hexList, isStr, strList } from './check.ts'
import type { Kind } from './types.ts'

const isHttp = (v: unknown): v is string => {
  try {
    return isStr(v, 2048) && /^https?:$/.test(new URL(v).protocol)
  } catch {
    return false
  }
}

export const link: Kind<'link'> = {
  label: 'Link',
  styleKeys: [],
  colors: (el) => el.colors ?? [],
  // strict on URLs: a file may come from someone else, and links open on Enter
  parse(e, box, { isPicture }) {
    if (!isHttp(e.url)) return null
    const ok = e.status === 'ok'
    return {
      ...box,
      type: 'link',
      url: e.url,
      title: isStr(e.title, 500) ? e.title : null,
      image: isPicture(e.image) ? e.image : null,
      fonts: strList(e.fonts),
      colors: hexList(e.colors),
      // a link still loading when it was saved will never finish: the one place that rule lives
      status: ok ? 'ok' : 'error',
      missing: strList(e.missing),
      ...(ok ? {} : { error: e.status === 'loading' ? 'Reading was interrupted.' : isStr(e.error, 300) ? e.error : 'Not read.' }),
    }
  },
}
