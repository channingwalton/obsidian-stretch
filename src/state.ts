/** Where the reader's open keys live between renders, shared by every view of one list. Pure. */
import type { Open } from './stretch'

export interface OpenState {
  get(): Open
  set(open: Open): void
  /** Calls the listener after each `set`; returns the way to stop. */
  subscribe(listener: () => void): () => void
}

export function openState(): OpenState {
  let open: Open = new Set()
  const listeners = new Set<() => void>()
  return {
    get: () => open,
    set: next => {
      open = next
      // One view failing to redraw must not leave the others out of step.
      for (const listen of [...listeners]) {
        try {
          listen()
        } catch (error) {
          console.error('stretch: a view failed to redraw', error)
        }
      }
    },
    subscribe: listen => {
      listeners.add(listen)
      return () => void listeners.delete(listen)
    },
  }
}
