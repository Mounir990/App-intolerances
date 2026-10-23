import type { ButtonHTMLAttributes, ReactNode } from 'react'

/** Cible tactile minimale : 48 px (recommandation Android/Material). */
const base =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 font-medium transition-colors disabled:opacity-50'

type Variant = 'primary' | 'soft' | 'ghost' | 'danger'
const variants: Record<Variant, string> = {
  primary: 'bg-sage-500 text-white active:bg-sage-700',
  soft: 'bg-sage-100 text-sage-700 active:bg-sage-200',
  ghost: 'bg-transparent text-sage-700 active:bg-sage-50',
  danger: 'bg-alert-bg text-alert active:bg-alert-bg/70',
}

export function Button({
  variant = 'soft',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={`${base} ${variants[variant]} ${className}`} {...props} />
}

export function Card({ title, hint, children }: { title?: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-sand-200">
      {title && <h2 className="text-lg font-semibold">{title}</h2>}
      {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
      <div className={title || hint ? 'mt-4' : ''}>{children}</div>
    </section>
  )
}

/** Sélecteur numérique à gros boutons − / + (saisie à une main). */
export function Stepper({
  label, value, min, max, unit, onChange,
}: { label: string; value: number; min: number; max: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span id={`st-${label}`}>{label}</span>
      <div className="flex items-center gap-2" role="group" aria-labelledby={`st-${label}`}>
        <Button aria-label="−" disabled={value <= min} onClick={() => onChange(value - 1)} className="w-12 px-0 text-2xl">−</Button>
        <span className="min-w-16 text-center tabular-nums">{value}{unit ? ` ${unit}` : ''}</span>
        <Button aria-label="+" disabled={value >= max} onClick={() => onChange(value + 1)} className="w-12 px-0 text-2xl">+</Button>
      </div>
    </div>
  )
}

export function Chip({ children, onRemove, removeLabel }: { children: ReactNode; onRemove?: () => void; removeLabel?: string }) {
  return (
    <span className="inline-flex min-h-10 items-center gap-1 rounded-full bg-sage-50 py-1 pl-4 pr-2 text-sage-700 ring-1 ring-sage-200">
      {children}
      {onRemove && (
        <button type="button" aria-label={removeLabel} onClick={onRemove}
          className="grid h-8 w-8 place-items-center rounded-full text-lg active:bg-sage-100">×</button>
      )}
    </span>
  )
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="px-4 pb-2 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {subtitle && <p className="mt-1 text-ink-soft">{subtitle}</p>}
    </header>
  )
}
