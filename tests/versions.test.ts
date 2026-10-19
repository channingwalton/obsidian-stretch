// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const json = (file: string) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'))

const manifest = json('manifest.json')
const pkg = json('package.json')
const lock = json('package-lock.json')

/** Compares dotted numeric versions such as "1.14.4": negative, zero or positive. */
const compare = (a: string, b: string): number => {
  const [x, y] = [a, b].map(v => v.split('.').map(Number))
  for (let i = 0; i < Math.max(x!.length, y!.length); i++) {
    const d = (x![i] ?? 0) - (y![i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

describe('versions', () => {
  it('agree between the manifest, package.json and the lock file', () => {
    expect({
      'package.json': pkg.version,
      'package-lock.json': lock.version,
      'package-lock.json root package': lock.packages[''].version,
    }).toEqual({
      'package.json': manifest.version,
      'package-lock.json': manifest.version,
      'package-lock.json root package': manifest.version,
    })
  })

  it('build against an Obsidian API no newer than the oldest Obsidian the manifest supports', () => {
    const api = lock.packages['node_modules/obsidian'].version
    expect(compare(api, manifest.minAppVersion), `obsidian ${api} vs minAppVersion ${manifest.minAppVersion}`)
      .toBeLessThanOrEqual(0)
  })
})

describe('compare', () => {
  it('orders versions part by part, numerically', () => {
    expect(compare('1.14.4', '1.14.4')).toBe(0)
    expect(compare('1.9.0', '1.14.4')).toBeLessThan(0)
    expect(compare('1.15.0', '1.14.4')).toBeGreaterThan(0)
    expect(compare('1.14', '1.14.0')).toBe(0)
  })
})
