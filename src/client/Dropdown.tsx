/**
 * Custom dropdown: button + overlay list, replacing native selects that
 * misbehave inside the desk's layered panels. Always renders the option list
 * when opened; an `emptyHint` shows when there are no options at all.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import css from './NovelPage.module.css'

export interface DropdownOption {
  readonly value: string
  readonly label: string
  readonly hint?: string
}

export function Dropdown(props: {
  options: readonly DropdownOption[]
  value: string | undefined
  onChange: (value: string) => void
  placeholder: string
  /** Shown instead of the list when `options` is empty. */
  emptyHint?: string
  width?: string
}): ReactNode {
  const { options, value, onChange, placeholder, emptyHint, width } = props
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent): void => {
      if (ref.current !== null && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => { window.removeEventListener('mousedown', close) }
  }, [open])

  const selected = options.find(option => option.value === value)

  return (
    <div className={css.dropdown} ref={ref} style={width !== undefined ? { width } : undefined}>
      <button type="button" className={css.dropdownTrigger} onClick={() => setOpen(value => !value)}>
        <span className={selected === undefined ? css.dropdownPlaceholder : css.dropdownValue}>
          {selected?.label ?? placeholder}
        </span>
        <span className={css.dropdownArrow}>▾</span>
      </button>
      {open && (
        <div className={css.dropdownList}>
          {options.length === 0
            ? <div className={css.dropdownEmpty}>{emptyHint ?? '—'}</div>
            : options.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={option.value === value ? `${css.dropdownItem} ${css.dropdownItemActive}` : css.dropdownItem}
                  onClick={() => { onChange(option.value); setOpen(false) }}
                >
                  <span>{option.label}</span>
                  {option.hint !== undefined && <span className={css.dropdownItemHint}>{option.hint}</span>}
                </button>
              ))}
        </div>
      )}
    </div>
  )
}
