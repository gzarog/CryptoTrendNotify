export type ClassValue = string | number | null | undefined | false | ClassDictionary | ClassArray

type ClassDictionary = { [id: string]: unknown }
type ClassArray = Array<ClassValue>

function toVal(value: ClassValue): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.map(toVal).filter(Boolean).join(' ')
  }

  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([, active]) => Boolean(active))
      .map(([key]) => key)
      .join(' ')
  }

  return ''
}

export function cn(...inputs: ClassValue[]): string {
  const classes = inputs.map(toVal).filter(Boolean).join(' ').trim()
  if (!classes) {
    return ''
  }

  const seen = new Set<string>()
  const result: string[] = []

  for (const token of classes.split(/\s+/)) {
    if (!seen.has(token)) {
      seen.add(token)
      result.push(token)
    }
  }

  return result.join(' ')
}
