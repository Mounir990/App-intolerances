import { useEffect, useId, type ButtonHTMLAttributes, type ReactNode } from 'react'

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

/** Choix unique à gros boutons (saisie à une main) : remplace un <select> de 3-4 options. */
export function Segmented<T extends string>({
  label, value, options, onChange, optionClass = 'min-w-14',
}: {
  label: string
  value: T
  options: { value: T; label: string; aria?: string }[]
  onChange: (v: T) => void
  /** Largeur minimale d'une option : plus large = retour à la ligne plutôt que du texte écrasé. */
  optionClass?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} aria-label={o.aria}
          onClick={() => onChange(o.value)}
          className={`min-h-12 flex-1 rounded-2xl px-3 text-sm font-medium ring-1 transition-colors ${optionClass} ${
            value === o.value ? 'bg-sage-500 text-white ring-sage-500' : 'bg-white text-ink ring-sand-200 active:bg-sage-50'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Pastille activable (étiquettes, types de FODMAP…). */
export function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={`min-h-11 rounded-full px-4 text-sm ring-1 transition-colors ${
        active ? 'bg-sage-500 text-white ring-sage-500' : 'bg-white text-ink ring-sand-200 active:bg-sage-50'}`}>
      {children}
    </button>
  )
}

/** Fenêtre modale (alertes avant enregistrement, enregistrement d'une recette). Échap ou clic à côté = fermer. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const id = useId()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3" onClick={onClose} role="presentation">
      <div role="alertdialog" aria-modal="true" aria-labelledby={id} onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-3xl bg-white p-5 shadow-xl ring-1 ring-sand-200">
        <h2 id={id} className="text-xl font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  )
}
