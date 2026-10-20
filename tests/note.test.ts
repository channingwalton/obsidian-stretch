import { describe, expect, it } from 'vitest'
import { listId } from '../src/note'

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
