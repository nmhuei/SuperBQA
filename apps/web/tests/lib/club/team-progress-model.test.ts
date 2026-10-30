import { describe, expect, it } from 'bun:test'
import {
  PROMINENT_CTF_CATEGORIES,
  calculateOverallProgress,
  calculateProgressPercentage,
  findResumeEvent,
  formatCategoryPercentage,
  formatProgressCount,
  formatProgressPercentage,
  normalizeCtfCategory,
  type TeamProgressEvent,
} from '$lib/club/team-progress-model'

describe('team-progress-model', () => {
  describe('PROMINENT_CTF_CATEGORIES', () => {
    it('defines the expected prominent categories in display order', () => {
      expect(PROMINENT_CTF_CATEGORIES).toEqual([
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

  describe('normalizeCtfCategory', () => {
    it('normalizes web categories', () => {
      expect(normalizeCtfCategory('web')).toBe('Web')
      expect(normalizeCtfCategory('WEB')).toBe('Web')
      expect(normalizeCtfCategory('Web')).toBe('Web')
      expect(normalizeCtfCategory('web-security')).toBe('Web')
      expect(normalizeCtfCategory('web-intro')).toBe('Web')
      expect(normalizeCtfCategory('web/api')).toBe('Web')
      expect(normalizeCtfCategory('web exploitation')).toBe('Web')
    })

    it('normalizes crypto categories', () => {
      expect(normalizeCtfCategory('crypto')).toBe('Crypto')
      expect(normalizeCtfCategory('CRYPTO')).toBe('Crypto')
      expect(normalizeCtfCategory('cryptography')).toBe('Crypto')
      expect(normalizeCtfCategory('crypto-rsa')).toBe('Crypto')
      expect(normalizeCtfCategory('crypto/ecc')).toBe('Crypto')
      expect(normalizeCtfCategory('cryptography-advanced')).toBe('Crypto')
    })

    it('normalizes pwn and binary exploitation categories', () => {
      expect(normalizeCtfCategory('pwn')).toBe('Pwn')
      expect(normalizeCtfCategory('PWN')).toBe('Pwn')
      expect(normalizeCtfCategory('binary exploitation')).toBe('Pwn')
      expect(normalizeCtfCategory('binary')).toBe('Pwn')
      expect(normalizeCtfCategory('pwn-heap')).toBe('Pwn')
      expect(normalizeCtfCategory('binary-exploitation')).toBe('Pwn')
    })

    it('normalizes reverse engineering categories', () => {
      expect(normalizeCtfCategory('rev')).toBe('Reverse')
      expect(normalizeCtfCategory('reverse')).toBe('Reverse')
      expect(normalizeCtfCategory('reverse engineering')).toBe('Reverse')
      expect(normalizeCtfCategory('reversing')).toBe('Reverse')
      expect(normalizeCtfCategory('rev-crackme')).toBe('Reverse')
      expect(normalizeCtfCategory('reverse-101')).toBe('Reverse')
    })

    it('normalizes forensics categories', () => {
      expect(normalizeCtfCategory('forensic')).toBe('Forensics')
      expect(normalizeCtfCategory('forensics')).toBe('Forensics')
      expect(normalizeCtfCategory('FORENSICS')).toBe('Forensics')
      expect(normalizeCtfCategory('forensic-pcap')).toBe('Forensics')
      expect(normalizeCtfCategory('forensics/network')).toBe('Forensics')
    })

    it('normalizes misc and miscellaneous categories', () => {
      expect(normalizeCtfCategory('misc')).toBe('Misc')
      expect(normalizeCtfCategory('miscellaneous')).toBe('Misc')
      expect(normalizeCtfCategory('MISC')).toBe('Misc')
      expect(normalizeCtfCategory('misc-stego')).toBe('Misc')
      expect(normalizeCtfCategory('miscellaneous-puzzle')).toBe('Misc')
    })

    it('normalizes unlisted and unknown categories to Other', () => {
      expect(normalizeCtfCategory('blockchain')).toBe('Other')
      expect(normalizeCtfCategory('osint')).toBe('Other')
      expect(normalizeCtfCategory('hardware')).toBe('Other')
      expect(normalizeCtfCategory('sanity')).toBe('Other')
      expect(normalizeCtfCategory('BQA')).toBe('Other')
      expect(normalizeCtfCategory('ppc')).toBe('Other')
      expect(normalizeCtfCategory('')).toBe('Other')
      expect(normalizeCtfCategory('   ')).toBe('Other')
      expect(normalizeCtfCategory(null as unknown as string)).toBe('Other')
      expect(normalizeCtfCategory(undefined as unknown as string)).toBe('Other')
    })
  })

  describe('calculateProgressPercentage', () => {
    it('returns 0 when total is 0 or negative', () => {
      expect(calculateProgressPercentage(0, 0)).toBe(0)
      expect(calculateProgressPercentage(5, 0)).toBe(0)
      expect(calculateProgressPercentage(0, -1)).toBe(0)
    })

    it('calculates rounded percentages correctly', () => {
      expect(calculateProgressPercentage(0, 10)).toBe(0)
      expect(calculateProgressPercentage(5, 10)).toBe(50)
      expect(calculateProgressPercentage(1, 3)).toBe(33)
      expect(calculateProgressPercentage(2, 3)).toBe(67)
      expect(calculateProgressPercentage(10, 10)).toBe(100)
    })

    it('clamps values between 0 and 100', () => {
      expect(calculateProgressPercentage(15, 10)).toBe(100)
      expect(calculateProgressPercentage(-5, 10)).toBe(0)
    })
  })

  describe('formatting helpers', () => {
    it('formats percentage strings', () => {
      expect(formatProgressPercentage(0)).toBe('0%')
      expect(formatProgressPercentage(50)).toBe('50%')
      expect(formatProgressPercentage(33.4)).toBe('33%')
      expect(formatProgressPercentage(66.6)).toBe('67%')
      expect(formatProgressPercentage(Number.NaN)).toBe('0%')
    })

    it('formats category percentage from counts', () => {
      expect(formatCategoryPercentage(0, 0)).toBe('0%')
      expect(formatCategoryPercentage(1, 4)).toBe('25%')
      expect(formatCategoryPercentage(2, 3)).toBe('67%')
      expect(formatCategoryPercentage(5, 5)).toBe('100%')
    })

    it('formats progress count string', () => {
      expect(formatProgressCount(0, 5)).toBe('0 / 5 solved')
      expect(formatProgressCount(3, 10)).toBe('3 / 10 solved')
    })
  })

  describe('calculateOverallProgress', () => {
    it('handles empty category lists', () => {
      expect(calculateOverallProgress([])).toEqual({
        totalSolved: 0,
        totalChallenges: 0,
        percentage: 0,
      })
    })

    it('aggregates solved and total counts and computes overall percentage', () => {
      const categories = [
        { solved: 2, total: 4 },
        { solved: 1, total: 2 },
        { solved: 0, total: 4 },
      ]
      expect(calculateOverallProgress(categories)).toEqual({
        totalSolved: 3,
        totalChallenges: 10,
        percentage: 30,
      })
    })

    it('handles categories with 0 totals safely', () => {
      const categories = [
        { solved: 0, total: 0 },
        { solved: 1, total: 1 },
      ]
      expect(calculateOverallProgress(categories)).toEqual({
        totalSolved: 1,
        totalChallenges: 1,
        percentage: 100,
      })
    })
  })

  describe('findResumeEvent', () => {
    const baseNow = 1_700_000_000_000

    it('returns null if there are no events', () => {
      expect(findResumeEvent([], baseNow)).toBeNull()
    })

    it('returns null if all events are fully solved', () => {
      const events: TeamProgressEvent[] = [
        {
          id: 'event-1',
          name: 'Event 1',
          startTime: baseNow - 1000,
          endTime: baseNow + 1000,
          solved: 5,
          total: 5,
        },
      ]
      expect(findResumeEvent(events, baseNow)).toBeNull()
    })

    it('prioritizes ongoing event with unsolved challenges', () => {
      const events: TeamProgressEvent[] = [
        {
          id: 'past-event',
          name: 'Past Event',
          startTime: baseNow - 20000,
          endTime: baseNow - 10000,
          solved: 1,
          total: 5,
        },
        {
          id: 'ongoing-event',
          name: 'Ongoing Event',
          startTime: baseNow - 5000,
          endTime: baseNow + 5000,
          solved: 2,
          total: 5,
        },
      ]
      const resume = findResumeEvent(events, baseNow)
      expect(resume?.id).toBe('ongoing-event')
    })

    it('falls back to the most recent past event if no ongoing events have unsolved challenges', () => {
      const events: TeamProgressEvent[] = [
        {
          id: 'older-past',
          name: 'Older Past',
          startTime: baseNow - 50000,
          endTime: baseNow - 40000,
          solved: 1,
          total: 5,
        },
        {
          id: 'recent-past',
          name: 'Recent Past',
          startTime: baseNow - 20000,
          endTime: baseNow - 10000,
          solved: 2,
          total: 5,
        },
        {
          id: 'ongoing-solved',
          name: 'Ongoing Solved',
          startTime: baseNow - 5000,
          endTime: baseNow + 5000,
          solved: 5,
          total: 5,
        },
      ]
      const resume = findResumeEvent(events, baseNow)
      expect(resume?.id).toBe('recent-past')
    })

    it('ignores future events that have not started yet', () => {
      const events: TeamProgressEvent[] = [
        {
          id: 'future-event',
          name: 'Future Event',
          startTime: baseNow + 10000,
          endTime: baseNow + 20000,
          solved: 0,
          total: 5,
        },
      ]
      expect(findResumeEvent(events, baseNow)).toBeNull()
    })
  })
})
