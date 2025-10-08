import type { getMultiTimeframeSignal } from '../../lib/signals'

export type MultiTimeframeSignal = NonNullable<ReturnType<typeof getMultiTimeframeSignal>>
