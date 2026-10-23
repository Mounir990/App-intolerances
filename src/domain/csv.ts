/**
 * Lecture/écriture CSV minimale (RFC 4180) : guillemets, virgules et retours à la
 * ligne dans les champs, guillemets doublés, BOM, fins de ligne CRLF ou LF.
 */

export interface CsvRow {
  /** Numéro de la ligne physique où commence l'enregistrement (1 = en-tête). */
  line: number
  cells: string[]
}

export function parseCsv(input: string): CsvRow[] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
  const rows: CsvRow[] = []
  let cells: string[] = []
  let cell = ''
  let inQuotes = false
  let line = 1
  let rowLine = 1
  const endRow = () => {
    cells.push(cell)
    // Ignore les lignes totalement vides (ex. saut de ligne final).
    if (!(cells.length === 1 && cells[0] === '')) rows.push({ line: rowLine, cells })
    cells = []
    cell = ''
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ } else inQuotes = false
      } else {
        if (ch === '\n') line++
        cell += ch
      }
      continue
    }
    if (ch === '"') inQuotes = true
    else if (ch === ',') { cells.push(cell); cell = '' }
    else if (ch === '\r') { /* ignoré : géré avec \n */ }
    else if (ch === '\n') { endRow(); line++; rowLine = line }
    else cell += ch
  }
  if (cell !== '' || cells.length > 0) endRow()
  return rows
}

/** Sérialise des lignes en CSV (guillemets seulement si nécessaire), fins de ligne LF. */
export function toCsv(rows: string[][]): string {
  const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return rows.map((r) => r.map(esc).join(',')).join('\n') + '\n'
}
