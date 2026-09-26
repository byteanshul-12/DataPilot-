// Text similarity ratio calculation and record deduplication service.
export function stringSimilarityRatio(str1: string, str2: string): number {
  if (str1 === str2) return 100;
  if (!str1.length || !str2.length) return 0;

  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  const len1 = s1.length;
  const len2 = s2.length;

  const track = Array(len2 + 1)
    .fill(null)
    .map(() => Array(len1 + 1).fill(0));

  for (let i = 0; i <= len1; i++) track[0][i] = i;
  for (let j = 0; j <= len2; j++) track[j][0] = j;

  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }

  const distance = track[len2][len1];
  const maxLen = Math.max(len1, len2);
  return Math.round(((maxLen - distance) / maxLen) * 100);
}

export function deduplicateRecords<T extends Record<string, any>>(
  records: T[],
  matchKey: keyof T,
  threshold = 85
): T[] {
  const result: T[] = [];
  for (const record of records) {
    const val = String(record[matchKey] || '');
    const isDuplicate = result.some(
      (existing) => stringSimilarityRatio(String(existing[matchKey]), val) >= threshold
    );
    if (!isDuplicate) {
      result.push(record);
    }
  }
  return result;
}
