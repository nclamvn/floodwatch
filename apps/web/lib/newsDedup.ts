/**
 * News Deduplication Utility for Frontend
 *
 * Layer 3 of the 3-layer defense-in-depth strategy.
 * Final dedup before rendering in carousel/ticker components.
 *
 * IMPORTANT: normalizeTitle() MUST match Python implementation exactly
 * to ensure consistent grouping across backend and frontend.
 */

export interface Report {
  id: string | number;
  title: string;
  description?: string;
  source?: string;
  source_domain?: string;
  normalized_title?: string;
  trust_score?: number;
  media?: Array<{ url: string; type: string }>;
  created_at?: string;
  [key: string]: unknown;
}

export interface DedupResult {
  reports: Report[];
  originalCount: number;
  dedupedCount: number;
  duplicatesRemoved: number;
}

// Vietnamese diacritics mapping (must match Python exactly)
const VIETNAMESE_CHARS: Record<string, string> = {
  'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
  'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
  'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
  'đ': 'd',
  'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
  'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
  'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
  'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
  'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
  'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
  'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
  'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
  'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
};

/**
 * Normalize title for comparison.
 * MUST match Python NewsDedupService.normalize_title() exactly.
 *
 * Steps:
 * 1. Lowercase
 * 2. Remove Vietnamese diacritics
 * 3. Remove punctuation and special chars
 * 4. Collapse whitespace
 * 5. Trim to 100 chars
 */
export function normalizeTitle(title: string): string {
  if (!title) return '';

  // Lowercase
  let text = title.toLowerCase();

  // Remove Vietnamese diacritics
  for (const [vietChar, asciiChar] of Object.entries(VIETNAMESE_CHARS)) {
    text = text.split(vietChar).join(asciiChar);
    // Also handle uppercase (already lowercased, but just in case)
    text = text.split(vietChar.toUpperCase()).join(asciiChar);
  }

  // Remove non-alphanumeric (keep spaces)
  text = text.replace(/[^\w\s]/g, '');

  // Collapse whitespace
  text = text.split(/\s+/).join(' ').trim();

  // Trim to 100 chars
  return text.slice(0, 100);
}

/**
 * Simple hash function for title grouping.
 * Not cryptographic, just for fast grouping.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Select the best report from a group of duplicates.
 *
 * Selection criteria (in order):
 * 1. Higher trust_score
 * 2. Has media (images/videos)
 * 3. Longer description
 * 4. More recent created_at
 */
function selectBestReport(group: Report[]): Report {
  if (group.length === 1) return group[0];

  return group.sort((a, b) => {
    // 1. Higher trust score
    const trustA = a.trust_score ?? 0;
    const trustB = b.trust_score ?? 0;
    if (trustB !== trustA) return trustB - trustA;

    // 2. Has media
    const mediaA = (a.media?.length ?? 0) > 0 ? 1 : 0;
    const mediaB = (b.media?.length ?? 0) > 0 ? 1 : 0;
    if (mediaB !== mediaA) return mediaB - mediaA;

    // 3. Longer description
    const descA = a.description?.length ?? 0;
    const descB = b.description?.length ?? 0;
    if (descB !== descA) return descB - descA;

    // 4. More recent
    const dateA = a.created_at ?? '';
    const dateB = b.created_at ?? '';
    return dateB.localeCompare(dateA);
  })[0];
}

/**
 * Deduplicate reports by grouping similar titles.
 *
 * @param reports - Array of report objects
 * @returns DedupResult with deduplicated reports and stats
 */
export function deduplicateReports(reports: Report[]): DedupResult {
  if (!reports || reports.length === 0) {
    return {
      reports: [],
      originalCount: 0,
      dedupedCount: 0,
      duplicatesRemoved: 0,
    };
  }

  const groups = new Map<string, Report[]>();

  for (const report of reports) {
    // Use pre-computed normalized_title if available, otherwise compute
    const titleKey = report.normalized_title || normalizeTitle(report.title || '');

    if (titleKey) {
      const hash = simpleHash(titleKey);
      const existing = groups.get(hash);
      if (existing) {
        existing.push(report);
      } else {
        groups.set(hash, [report]);
      }
    } else {
      // Reports without titles go into their own groups
      groups.set(`__no_title_${report.id}`, [report]);
    }
  }

  const dedupedReports = Array.from(groups.values()).map(selectBestReport);

  // Log in development mode
  if (process.env.NODE_ENV === 'development') {
    const duplicatesRemoved = reports.length - dedupedReports.length;
    if (duplicatesRemoved > 0) {
      console.log(`[NewsDedup] Removed ${duplicatesRemoved} duplicates from ${reports.length} reports`);

      // Log duplicate groups for debugging
      groups.forEach((group, hash) => {
        if (group.length > 1) {
          console.log(`  - Group "${group[0].title?.slice(0, 50)}...": ${group.length} duplicates from sources:`,
            group.map(r => r.source_domain || extractDomain(r.source || '')).join(', ')
          );
        }
      });
    }
  }

  return {
    reports: dedupedReports,
    originalCount: reports.length,
    dedupedCount: dedupedReports.length,
    duplicatesRemoved: reports.length - dedupedReports.length,
  };
}

/**
 * Extract domain from URL (helper for logging).
 */
function extractDomain(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    let domain = parsed.hostname;
    if (domain.startsWith('www.')) {
      domain = domain.slice(4);
    }
    return domain;
  } catch {
    return '';
  }
}

/**
 * Calculate similarity ratio between two titles.
 * Uses Levenshtein-based similarity.
 */
export function calculateSimilarity(title1: string, title2: string): number {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);

  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 1;

  // Simple similarity based on common characters
  const longer = norm1.length > norm2.length ? norm1 : norm2;
  const shorter = norm1.length > norm2.length ? norm2 : norm1;

  if (longer.length === 0) return 1;

  // Use edit distance for similarity
  const editDistance = levenshteinDistance(norm1, norm2);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance for fuzzy matching.
 */
function levenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;

  const dp: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[len1][len2];
}
