import { describe, expect, it, vi } from 'vitest'
import { openState } from '../src/state'

describe('openState', () => {
  it('starts with nothing open and keeps what is set', () => {
    const state = openState()
    expect([...state.get()]).toEqual([])
    state.set(new Set(['0']))
    expect([...state.get()]).toEqual(['0'])
  })

  it('tells each subscriber after a set, until it unsubscribes', () => {
    const state = openState()
    const a = vi.fn()
    const b = vi.fn()
    const stopA = state.subscribe(a)
    state.subscribe(b)
    state.set(new Set(['0']))
    stopA()
    state.set(new Set())
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(2)
  })

  it('lets a subscriber unsubscribe while being told, without skipping the others', () => {
    const state = openState()
    const b = vi.fn()
    const stopA = state.subscribe(() => stopA())
    state.subscribe(b)
    state.set(new Set(['0']))
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('still tells the other subscribers when one of them throws', () => {
    const state = openState()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const b = vi.fn()
    state.subscribe(() => {
      throw new Error('gone')
    })
    state.subscribe(b)
    state.set(new Set(['0']))
    expect(b).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledTimes(1)
    error.mockRestore()
  })
})
