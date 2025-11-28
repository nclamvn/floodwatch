import {
  normalizeTitle,
  deduplicateReports,
  calculateSimilarity,
  type Report,
} from '@/lib/newsDedup'

describe('newsDedup', () => {
  describe('normalizeTitle', () => {
    it('should return empty string for falsy input', () => {
      expect(normalizeTitle('')).toBe('')
      expect(normalizeTitle(null as unknown as string)).toBe('')
      expect(normalizeTitle(undefined as unknown as string)).toBe('')
    })

    it('should lowercase the title', () => {
      expect(normalizeTitle('HELLO WORLD')).toBe('hello world')
      expect(normalizeTitle('Hello World')).toBe('hello world')
    })

    it('should remove Vietnamese diacritics', () => {
      expect(normalizeTitle('Đà Nẵng')).toBe('da nang')
      expect(normalizeTitle('Hà Nội')).toBe('ha noi')
      expect(normalizeTitle('Thành phố Hồ Chí Minh')).toBe('thanh pho ho chi minh')
      expect(normalizeTitle('Bão số 3 đổ bộ')).toBe('bao so 3 do bo')
    })

    it('should remove punctuation and special characters', () => {
      expect(normalizeTitle('Hello, World!')).toBe('hello world')
      expect(normalizeTitle('News: Breaking!')).toBe('news breaking')
      expect(normalizeTitle('Test@#$%test')).toBe('testtest')
    })

    it('should collapse multiple whitespaces', () => {
      expect(normalizeTitle('hello    world')).toBe('hello world')
      expect(normalizeTitle('  spaced   out  ')).toBe('spaced out')
    })

    it('should trim to 100 characters', () => {
      const longTitle = 'a'.repeat(150)
      expect(normalizeTitle(longTitle).length).toBe(100)
    })
  })

  describe('deduplicateReports', () => {
    it('should return empty result for empty input', () => {
      const result = deduplicateReports([])
      expect(result.reports).toEqual([])
      expect(result.originalCount).toBe(0)
      expect(result.dedupedCount).toBe(0)
      expect(result.duplicatesRemoved).toBe(0)
    })

    it('should return empty result for null input', () => {
      const result = deduplicateReports(null as unknown as Report[])
      expect(result.reports).toEqual([])
    })

    it('should not remove unique reports', () => {
      const reports: Report[] = [
        { id: '1', title: 'First news article', trust_score: 0.8 },
        { id: '2', title: 'Second news article', trust_score: 0.7 },
        { id: '3', title: 'Third news article', trust_score: 0.9 },
      ]
      const result = deduplicateReports(reports)
      expect(result.reports).toHaveLength(3)
      expect(result.duplicatesRemoved).toBe(0)
    })

    it('should remove duplicate reports with same normalized title', () => {
      const reports: Report[] = [
        { id: '1', title: 'Bão số 3 đổ bộ vào Đà Nẵng', trust_score: 0.8 },
        { id: '2', title: 'Bao so 3 do bo vao Da Nang', trust_score: 0.7 },
        { id: '3', title: 'Different news', trust_score: 0.9 },
      ]
      const result = deduplicateReports(reports)
      expect(result.reports).toHaveLength(2)
      expect(result.duplicatesRemoved).toBe(1)
    })

    it('should select report with higher trust_score from duplicates', () => {
      const reports: Report[] = [
        { id: '1', title: 'Same news', trust_score: 0.5 },
        { id: '2', title: 'Same news', trust_score: 0.9 },
        { id: '3', title: 'Same news', trust_score: 0.7 },
      ]
      const result = deduplicateReports(reports)
      expect(result.reports).toHaveLength(1)
      expect(result.reports[0].id).toBe('2')
      expect(result.reports[0].trust_score).toBe(0.9)
    })

    it('should prefer reports with media when trust_score is equal', () => {
      const reports: Report[] = [
        { id: '1', title: 'Same news', trust_score: 0.8 },
        { id: '2', title: 'Same news', trust_score: 0.8, media: [{ url: 'test.jpg', type: 'image' }] },
      ]
      const result = deduplicateReports(reports)
      expect(result.reports).toHaveLength(1)
      expect(result.reports[0].id).toBe('2')
    })

    it('should prefer reports with longer description', () => {
      const reports: Report[] = [
        { id: '1', title: 'Same news', trust_score: 0.8, description: 'Short' },
        { id: '2', title: 'Same news', trust_score: 0.8, description: 'This is a much longer description' },
      ]
      const result = deduplicateReports(reports)
      expect(result.reports).toHaveLength(1)
      expect(result.reports[0].id).toBe('2')
    })

    it('should use pre-computed normalized_title if available', () => {
      const reports: Report[] = [
        { id: '1', title: 'Different title 1', normalized_title: 'same', trust_score: 0.8 },
        { id: '2', title: 'Different title 2', normalized_title: 'same', trust_score: 0.7 },
      ]
      const result = deduplicateReports(reports)
      expect(result.reports).toHaveLength(1)
      expect(result.duplicatesRemoved).toBe(1)
    })
  })

  describe('calculateSimilarity', () => {
    it('should return 0 for empty strings', () => {
      expect(calculateSimilarity('', 'test')).toBe(0)
      expect(calculateSimilarity('test', '')).toBe(0)
      expect(calculateSimilarity('', '')).toBe(0)
    })

    it('should return 1 for identical strings', () => {
      expect(calculateSimilarity('hello world', 'hello world')).toBe(1)
    })

    it('should return 1 for strings that normalize to same value', () => {
      expect(calculateSimilarity('Đà Nẵng', 'Da Nang')).toBe(1)
      expect(calculateSimilarity('HELLO', 'hello')).toBe(1)
    })

    it('should return high similarity for similar strings', () => {
      const similarity = calculateSimilarity('hello world', 'hello worlds')
      expect(similarity).toBeGreaterThan(0.8)
    })

    it('should return low similarity for different strings', () => {
      const similarity = calculateSimilarity('completely different', 'totally unrelated')
      expect(similarity).toBeLessThan(0.5)
    })
  })
})
