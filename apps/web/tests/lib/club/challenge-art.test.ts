import { describe, expect, test } from 'bun:test'
import { getChallengeArt } from '../../../src/lib/club/challenge-art'

describe('getChallengeArt', () => {
  test('keeps a challenge visually stable across repeated renders', () => {
    expect(getChallengeArt('web-portal-42', 'web')).toEqual(
      getChallengeArt('web-portal-42', 'web')
    )
  })

  test('gives challenges in the same category distinct compositions', () => {
    const compositions = Array.from({ length: 100 }, (_, index) =>
      JSON.stringify(getChallengeArt(`challenge-${index}`, 'web'))
    )
    expect(new Set(compositions).size).toBe(100)
  })

  test('uses a consistent category palette including common aliases', () => {
    expect(getChallengeArt('first', 'web').color).toBe(
      getChallengeArt('second', 'WEB').color
    )
    expect(getChallengeArt('first', 'web').color).not.toBe(
      getChallengeArt('first', 'crypto').color
    )
    expect(getChallengeArt('first', 'cryptography').color).toBe(
      getChallengeArt('second', 'crypto').color
    )
    expect(getChallengeArt('first', 'binary').color).toBe(
      getChallengeArt('second', 'pwn').color
    )
  })

  test.each([
    ['empty', ''],
    ['whitespace', ' '],
    ['prototype key', '__proto__'],
    ['constructor key', 'constructor'],
    ['markup', '</svg><script>alert(1)</script>'],
    ['long unicode', '🚩'.repeat(1000)],
  ])(
    'produces usable numeric geometry and fixed colors for %s input',
    (_label, input) => {
      const art = getChallengeArt(input, input)
      expect(art.color).toMatch(/^#[0-9a-f]{6}$/)
      expect(art.radius).toBeGreaterThan(0)
      expect(art.x).toBeGreaterThanOrEqual(0)
      expect(art.x).toBeLessThanOrEqual(400)
      expect(art.y).toBeGreaterThanOrEqual(0)
      expect(art.y).toBeLessThanOrEqual(180)
      for (const [key, value] of Object.entries(art)) {
        if (key !== 'color') {
          expect(typeof value).toBe('number')
          expect(Number.isFinite(value)).toBe(true)
        }
      }
      expect(getChallengeArt(input, input)).toEqual(art)
    }
  )
})
