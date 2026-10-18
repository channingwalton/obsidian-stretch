import { describe, expect, it } from 'vitest'
import { listId, optsIn } from '../src/note'

describe('optsIn', () => {
  it('accepts stretch in a cssclasses list', () => {
    expect(optsIn({ cssclasses: ['wide', 'stretch'] })).toBe(true)
  })
  it('accepts stretch in a space-separated cssclasses string', () => {
    expect(optsIn({ cssclasses: 'wide stretch' })).toBe(true)
  })
  it('accepts the older cssclass key', () => {
    expect(optsIn({ cssclass: 'stretch' })).toBe(true)
  })
  it('rejects notes without the class, without frontmatter, and with a different class', () => {
    expect(optsIn({ cssclasses: ['stretchy'] })).toBe(false)
    expect(optsIn(undefined)).toBe(false)
    expect(optsIn(null)).toBe(false)
    expect(optsIn({})).toBe(false)
    expect(optsIn({ cssclasses: 42 })).toBe(false)
  })
})

describe('listId', () => {
  it('tells lists apart by note, section line and position within the section', () => {
    expect(listId('a.md', 3, 0)).not.toBe(listId('a.md', 3, 1))
    expect(listId('a.md', 3, 0)).not.toBe(listId('b.md', 3, 0))
    expect(listId('a.md', 3, 0)).not.toBe(listId('a.md', 9, 0))
  })
  it('falls back to the list text when the section line is unknown', () => {
    expect(listId('a.md', null, 0, 'one list')).not.toBe(listId('a.md', null, 0, 'another list'))
    expect(listId('a.md', null, 0, 'one list')).toBe(listId('a.md', null, 0, 'one list'))
    expect(listId('a.md', null, 0)).not.toBe(listId('a.md', null, 1))
  })
})
