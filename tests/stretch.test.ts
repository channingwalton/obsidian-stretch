import { describe, expect, it } from 'vitest'
import { layout, parentKey, toggle, type Node } from '../src/stretch'

const n = (content: string, children: Node<string>[] = []): Node<string> => ({ content, children })

const tree: Node<string>[] = [
  n('A', [n('A1', [n('A1a')]), n('A2')]),
  n('B'),
]

const keys = (segments: ReturnType<typeof layout<string>>) => segments.map(s => s.key)

describe('layout', () => {
  it('shows only the top level when nothing is open', () => {
    const segments = layout(tree, new Set())
    expect(keys(segments)).toEqual(['0', '1'])
    expect(segments.map(s => s.content)).toEqual(['A', 'B'])
  })

  it('marks which segments can open', () => {
    const segments = layout(tree, new Set())
    expect(segments.map(s => s.hasChildren)).toEqual([true, false])
    expect(segments.map(s => s.open)).toEqual([false, false])
  })

  it('opening a node shows its direct children after it, not its grandchildren', () => {
    const segments = layout(tree, new Set(['0']))
    expect(keys(segments)).toEqual(['0', '0.0', '0.1', '1'])
    expect(segments[0]?.open).toBe(true)
    expect(segments.map(s => s.depth)).toEqual([0, 1, 1, 0])
  })

  it('opens nested levels one at a time', () => {
    expect(keys(layout(tree, new Set(['0', '0.0'])))).toEqual(['0', '0.0', '0.0.0', '0.1', '1'])
  })

  it('ignores an open child whose parent is closed', () => {
    expect(keys(layout(tree, new Set(['0.0'])))).toEqual(['0', '1'])
  })
})

describe('toggle', () => {
  it('opens a closed key', () => {
    expect([...toggle(new Set(), '0')]).toEqual(['0'])
  })

  it('closes an open key together with everything beneath it', () => {
    const open = new Set(['0', '0.0', '0.0.0', '1'])
    expect([...toggle(open, '0')].sort()).toEqual(['1'])
  })

  it('closing "0" leaves "01" alone: descendants are matched by path, not prefix', () => {
    expect([...toggle(new Set(['0', '01']), '0')]).toEqual(['01'])
  })

  it('does not mutate its input', () => {
    const open = new Set(['0'])
    toggle(open, '0')
    expect([...open]).toEqual(['0'])
  })
})

describe('parentKey', () => {
  it('is the key one level up, and nothing for a top-level key', () => {
    expect(parentKey('0.2.1')).toBe('0.2')
    expect(parentKey('0.2')).toBe('0')
    expect(parentKey('3')).toBeUndefined()
  })
})
