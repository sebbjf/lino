import { useState } from 'react'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { normalizeHex } from '../palette/colors.ts'

/** Native colour picker plus a hex field; calls onChange only with valid, normalized hex values. */
export function ColorFields({ hex, onChange }: { hex: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState(hex)
  const [prevHex, setPrevHex] = useState(hex)
  if (hex !== prevHex) {
    // follow changes made by the native picker
    setPrevHex(hex)
    if (normalizeHex(draft) !== hex) setDraft(hex)
  }
  const invalid = normalizeHex(draft) === null

  return (
    <FieldGroup className="gap-3">
      <Field>
        <FieldLabel htmlFor="color-native">Color</FieldLabel>
        <input
          id="color-native"
          type="color"
          className="color-well h-24 w-full cursor-pointer rounded-xl"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>
      <Field data-invalid={invalid || undefined}>
        <FieldLabel htmlFor="color-hex">Hex</FieldLabel>
        <Input
          id="color-hex"
          className="font-mono"
          spellCheck={false}
          autoComplete="off"
          value={draft}
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            setDraft(e.target.value)
            const h = normalizeHex(e.target.value)
            if (h) onChange(h)
          }}
        />
        {invalid && <FieldError>Use 3 or 6 hex digits, like #d6c7b4.</FieldError>}
      </Field>
    </FieldGroup>
  )
}
