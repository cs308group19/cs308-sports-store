/**
 * The assistant's product search. The shop search needs every word to match, which is too strict
 * for a chat ("running shoes for asphalt"), so here the products matching the most words win.
 */

/** Words that say nothing about a product. */
const STOP_WORDS = new Set(
  'a an and any are best cheap find for from good have i in is it me my need new of on or please some that the to under want with you'.split(
    ' ',
  ),
);
const MAX_WORDS = 8;
const MAX_QUERY_LENGTH = 100;

/** Lowercase words worth searching for, with simple plurals cut: "shoes" finds "shoe" too. */
export function searchWords(query: string): string[] {
  const words = query
    .slice(0, MAX_QUERY_LENGTH)
    .toLowerCase()
    .split(/[^\p{L}\p{N}-]+/u)
    .filter((word) => word.length > 1 || /\p{N}/u.test(word))
    .filter((word) => !STOP_WORDS.has(word))
    .map((word) =>
      word.length > 3 && word.endsWith('s') && !word.endsWith('ss')
        ? word.slice(0, -1)
        : word,
    );
  return [...new Set(words)].slice(0, MAX_WORDS);
}

function contains(text: string, word: string): boolean {
  if (word.length > 3) return text.includes(word);
  // Short words must start a word, so that "men" does not find "women".
  return ` ${text.replace(/[^\p{L}\p{N}]+/gu, ' ')}`.includes(` ${word}`);
}

/**
 * The items that match the most words, in their original order. Nothing when no word matches;
 * every item when there is no word to search for.
 */
export function bestMatches<T>(
  items: readonly T[],
  query: string,
  textOf: (item: T) => string,
): { matches: T[]; allWords: boolean } {
  const words = searchWords(query);
  if (words.length === 0) return { matches: [...items], allWords: true };

  const scored = items.map((item) => {
    const text = textOf(item).toLowerCase();
    return { item, score: words.filter((word) => contains(text, word)).length };
  });
  const best = Math.max(0, ...scored.map(({ score }) => score));
  return {
    matches:
      best === 0
        ? []
        : scored.filter(({ score }) => score === best).map(({ item }) => item),
    allWords: best === words.length,
  };
}
