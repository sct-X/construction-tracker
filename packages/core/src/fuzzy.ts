/**
 * Fuzzy matching of what Dominic types or says against names in the data:
 * jobs, trades, items, shipments, stages, steps, photo categories.
 *
 * A candidate matches when every meaningful word of the query matches one of
 * its words (exactly, as a prefix of 3+ letters, plural/singular, or within a
 * small typo distance). Among matches, a candidate whose words are all covered
 * beats partial ones. Still more than one: ambiguous, and the caller asks.
 */

export interface MatchCandidate<T = unknown> {
  id: string;
  /** The display name ("Park Rd windows"). */
  name: string;
  /** Other words it answers to (job name, trade type, "pump"). */
  aliases?: string[];
  value?: T;
}

export type MatchResult<T = unknown> =
  | { kind: 'unique'; match: MatchCandidate<T>; score: number }
  | { kind: 'ambiguous'; candidates: MatchCandidate<T>[] }
  | { kind: 'none' };

const STOPWORDS = new Set([
  'the', 'a', 'an', 'at', 'on', 'for', 'of', 'to', 'in', 'our', 'my', 'job', 'site', 'and', 'with', 'from', 'up',
  'some', 'this', 'that', 'those', 'these', 'is', 'are', 'stuff', 'lot',
]);

const SYNONYMS: Record<string, string> = {
  rd: 'road',
  st: 'street',
  str: 'street',
  ave: 'avenue',
  av: 'avenue',
  pde: 'parade',
  hwy: 'highway',
  dr: 'drive',
  ln: 'lane',
  pl: 'place',
  cres: 'crescent',
  sparky: 'electrician',
  sparkie: 'electrician',
  sparkies: 'electrician',
  chippy: 'carpenter',
  chippie: 'carpenter',
  chippies: 'carpenter',
  brickie: 'bricklayer',
  brickies: 'bricklayer',
  plumbers: 'plumber',
  insp: 'inspection',
  reo: 'reinforcement',
  oc: 'occupation',
};

export function normalizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/['’]s\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => SYNONYMS[w] ?? w);
}

function meaningful(words: string[]): string[] {
  const kept = words.filter((w) => !STOPWORDS.has(w));
  return kept.length ? kept : words;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length]!;
}

function singular(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 3 && w.endsWith('es') && /(sh|ch|x|ss)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/** 1 for an exact (or plural) match, 0.8 for a prefix or typo, 0 for none. */
function wordScore(q: string, c: string): number {
  if (q === c) return 1;
  const qs = singular(q);
  const cs = singular(c);
  if (qs === cs) return 1;
  if (/^\d+$/.test(q) || /^\d+$/.test(c)) return 0; // numbers match exactly or not at all
  if (qs.length >= 3 && cs.startsWith(qs)) return 0.8;
  const allowed = cs.length >= 8 ? 2 : cs.length >= 4 ? 1 : 0;
  if (allowed && levenshtein(qs, cs) <= allowed) return 0.8;
  return 0;
}

interface Scored<T> {
  candidate: MatchCandidate<T>;
  /** Every query word matched. */
  full: boolean;
  /** Share of the candidate's own words the query covered (0..1). */
  coverage: number;
  quality: number;
}

function scoreAgainst(queryWords: string[], text: string): { full: boolean; coverage: number; quality: number } {
  const cWords = meaningful(normalizeWords(text));
  if (!cWords.length) return { full: false, coverage: 0, quality: 0 };
  const used = new Set<number>();
  let quality = 0;
  let matched = 0;
  for (const q of queryWords) {
    let best = 0;
    let bestIdx = -1;
    cWords.forEach((c, i) => {
      const s = wordScore(q, c);
      if (s > best) {
        best = s;
        bestIdx = i;
      }
    });
    if (best > 0) {
      matched++;
      quality += best;
      used.add(bestIdx);
    }
  }
  return { full: matched === queryWords.length, coverage: used.size / cWords.length, quality: quality / queryWords.length };
}

/**
 * Matches `query` against candidates. Exact id or exact name (case-insensitive)
 * wins outright. Otherwise see the module comment.
 */
export function fuzzyMatch<T>(query: string, candidates: MatchCandidate<T>[]): MatchResult<T> {
  const q = query.trim();
  if (!q || !candidates.length) return { kind: 'none' };
  const byId = candidates.find((c) => c.id === q);
  if (byId) return { kind: 'unique', match: byId, score: 1 };
  const lower = q.toLowerCase();
  const exactName = candidates.filter((c) => c.name.toLowerCase() === lower || c.aliases?.some((a) => a.toLowerCase() === lower));
  if (exactName.length === 1) return { kind: 'unique', match: exactName[0]!, score: 1 };

  const queryWords = meaningful(normalizeWords(q));
  if (!queryWords.length) return { kind: 'none' };

  const scored: Scored<T>[] = [];
  for (const c of candidates) {
    let best = scoreAgainst(queryWords, c.name);
    for (const a of c.aliases ?? []) {
      const s = scoreAgainst(queryWords, a);
      if (s.full && (!best.full || s.quality > best.quality)) best = s;
    }
    // A query can mix the name and an alias ("Park Rd windows" vs name "Windows", alias "Park Rd").
    if (!best.full && c.aliases?.length) {
      const s = scoreAgainst(queryWords, [c.name, ...c.aliases].join(' '));
      if (s.full) best = { ...s, coverage: scoreAgainst(queryWords, c.name).coverage };
    }
    if (best.full) scored.push({ candidate: c, ...best });
  }
  if (!scored.length) return { kind: 'none' };
  if (scored.length === 1) return { kind: 'unique', match: scored[0]!.candidate, score: scored[0]!.quality };

  // Prefer candidates fully covered by the query, then better word quality.
  const complete = scored.filter((s) => s.coverage === 1);
  const pool = complete.length ? complete : scored;
  const topQuality = Math.max(...pool.map((s) => s.quality));
  const top = pool.filter((s) => s.quality === topQuality);
  if (top.length === 1) return { kind: 'unique', match: top[0]!.candidate, score: topQuality };
  return { kind: 'ambiguous', candidates: top.map((s) => s.candidate) };
}
