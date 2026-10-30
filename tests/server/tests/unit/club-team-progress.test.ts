import {
  ClubTeamProgressCategorySchema,
  ClubTeamProgressDataSchema,
  ClubTeamProgressEventSchema,
  GoodClubTeamProgress,
} from '@rctf/types'
import { describe, expect, test } from 'bun:test'
import {
  normalizeCategory,
  PROMINENT_CATEGORIES,
} from '../../../../apps/api/src/services/club-events'

describe('club team progress unit tests', () => {
  describe('normalizeCategory', () => {
    test('normalizes web categories to Web', () => {
      expect(normalizeCategory('web')).toBe('Web')
      expect(normalizeCategory('Web')).toBe('Web')
      expect(normalizeCategory('WEB')).toBe('Web')
      expect(normalizeCategory('web-exploitation')).toBe('Web')
      expect(normalizeCategory('web/intro')).toBe('Web')
      expect(normalizeCategory('web security')).toBe('Web')
      expect(normalizeCategory('  web-client  ')).toBe('Web')
    })

    test('normalizes crypto categories to Crypto', () => {
      expect(normalizeCategory('crypto')).toBe('Crypto')
      expect(normalizeCategory('Crypto')).toBe('Crypto')
      expect(normalizeCategory('cryptography')).toBe('Crypto')
      expect(normalizeCategory('Cryptography')).toBe('Crypto')
      expect(normalizeCategory('crypto-rsa')).toBe('Crypto')
      expect(normalizeCategory('crypto/math')).toBe('Crypto')
    })

    test('normalizes pwn categories to Pwn', () => {
      expect(normalizeCategory('pwn')).toBe('Pwn')
      expect(normalizeCategory('Pwn')).toBe('Pwn')
      expect(normalizeCategory('binary exploitation')).toBe('Pwn')
      expect(normalizeCategory('binary-exploitation')).toBe('Pwn')
      expect(normalizeCategory('pwnable')).toBe('Pwn')
      expect(normalizeCategory('pwn-rop')).toBe('Pwn')
    })

    test('normalizes reverse categories to Reverse', () => {
      expect(normalizeCategory('rev')).toBe('Reverse')
      expect(normalizeCategory('Rev')).toBe('Reverse')
      expect(normalizeCategory('reverse')).toBe('Reverse')
      expect(normalizeCategory('Reverse')).toBe('Reverse')
      expect(normalizeCategory('reverse engineering')).toBe('Reverse')
      expect(normalizeCategory('reverse-engineering')).toBe('Reverse')
      expect(normalizeCategory('reversing')).toBe('Reverse')
      expect(normalizeCategory('rev-wasm')).toBe('Reverse')
    })

    test('normalizes forensics categories to Forensics', () => {
      expect(normalizeCategory('forensic')).toBe('Forensics')
      expect(normalizeCategory('Forensic')).toBe('Forensics')
      expect(normalizeCategory('forensics')).toBe('Forensics')
      expect(normalizeCategory('Forensics')).toBe('Forensics')
      expect(normalizeCategory('forensic-pcap')).toBe('Forensics')
      expect(normalizeCategory('forensics-disk')).toBe('Forensics')
    })

    test('normalizes misc categories to Misc', () => {
      expect(normalizeCategory('misc')).toBe('Misc')
      expect(normalizeCategory('Misc')).toBe('Misc')
      expect(normalizeCategory('miscellaneous')).toBe('Misc')
      expect(normalizeCategory('Miscellaneous')).toBe('Misc')
      expect(normalizeCategory('misc-sandbox')).toBe('Misc')
    })

    test('normalizes unknown or empty categories to Other', () => {
      expect(normalizeCategory('osint')).toBe('Other')
      expect(normalizeCategory('hardware')).toBe('Other')
      expect(normalizeCategory('blockchain')).toBe('Other')
      expect(normalizeCategory('ai')).toBe('Other')
      expect(normalizeCategory('')).toBe('Other')
      expect(normalizeCategory(undefined)).toBe('Other')
      expect(normalizeCategory(null)).toBe('Other')
      expect(normalizeCategory('   ')).toBe('Other')
    })
  })

  describe('PROMINENT_CATEGORIES', () => {
    test('contains prominent CTF categories in specified display order', () => {
      expect(PROMINENT_CATEGORIES).toEqual([
        'Web',
        'Crypto',
        'Pwn',
        'Reverse',
        'Forensics',
        'Misc',
        'Other',
      ])
    })
  })

  describe('Team Progress schemas', () => {
    test('validates ClubTeamProgressCategorySchema', () => {
      const valid = {
        category: 'Web',
        solved: 2,
        total: 5,
        percentage: 40,
      }
      expect(ClubTeamProgressCategorySchema.parse(valid)).toEqual(valid)
      expect(() =>
        ClubTeamProgressCategorySchema.parse({
          category: 'Web',
          solved: 'two',
          total: 5,
          percentage: 40,
        })
      ).toThrow()
    })

    test('validates ClubTeamProgressEventSchema', () => {
      const valid = {
        id: 'event-1',
        name: 'Weekly Mini CTF',
        startTime: 1000,
        endTime: 2000,
        solved: 1,
        total: 3,
      }
      expect(ClubTeamProgressEventSchema.parse(valid)).toEqual(valid)
      expect(() =>
        ClubTeamProgressEventSchema.parse({
          id: 'event-1',
          name: 'Weekly Mini CTF',
          startTime: 'invalid',
          endTime: 2000,
          solved: 1,
          total: 3,
        })
      ).toThrow()
    })

    test('validates ClubTeamProgressDataSchema and GoodClubTeamProgress', () => {
      const data = {
        totalSolved: 3,
        totalChallenges: 8,
        percentage: 38,
        categories: [
          { category: 'Web', solved: 2, total: 4, percentage: 50 },
          { category: 'Crypto', solved: 1, total: 4, percentage: 25 },
        ],
        events: [
          {
            id: 'event-1',
            name: 'Weekly Mini CTF',
            startTime: 1000,
            endTime: 2000,
            solved: 3,
            total: 8,
          },
        ],
      }
      expect(ClubTeamProgressDataSchema.parse(data)).toEqual(data)
      expect(GoodClubTeamProgress.kind).toBe('goodClubTeamProgress')
      expect(GoodClubTeamProgress.status).toBe(200)
      expect(GoodClubTeamProgress.message).toBe('Team progress was retrieved.')
      const parsed = GoodClubTeamProgress.schema.parse({
        kind: 'goodClubTeamProgress',
        message: 'Team progress was retrieved.',
        data,
      })
      expect(parsed.data).toEqual(data)
    })
  })
})
