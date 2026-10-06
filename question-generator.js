export const MIN_TABLE = 2;
export const MAX_TABLE = 12;
export const TABLES = Object.freeze(
  Array.from({ length: MAX_TABLE - MIN_TABLE + 1 }, (_, index) => index + MIN_TABLE),
);

function shuffle(items, random) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function normaliseTables(tables) {
  return [...new Set(tables.map(Number))].filter(
    (table) => Number.isInteger(table) && table >= MIN_TABLE && table <= MAX_TABLE,
  );
}

/**
 * Build multiplication questions without repeating the same fact until the
 * available pool is exhausted. The strategy is deliberately replaceable so
 * official-style weighting can be added later if it is verified.
 */
export function generateQuestions(count, tables = TABLES, random = Math.random) {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError("Question count must be a positive integer.");
  }

  const selectedTables = normaliseTables(tables);
  if (selectedTables.length === 0) {
    throw new RangeError("Choose at least one multiplication table.");
  }

  const facts = [];
  const seen = new Set();

  for (const table of selectedTables) {
    for (let multiplier = MIN_TABLE; multiplier <= MAX_TABLE; multiplier += 1) {
      const key = [Math.min(table, multiplier), Math.max(table, multiplier)].join("-");
      if (seen.has(key)) continue;
      seen.add(key);
      facts.push({ table, multiplier, answer: table * multiplier, key });
    }
  }

  const output = [];
  while (output.length < count) {
    const batch = shuffle(facts, random);
    for (const fact of batch) {
      if (output.length >= count) break;
      const reverse = random() >= 0.5;
      output.push({
        left: reverse ? fact.multiplier : fact.table,
        right: reverse ? fact.table : fact.multiplier,
        answer: fact.answer,
        key: fact.key,
      });
    }
  }

  return output;
}
