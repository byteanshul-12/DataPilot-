// RapidFuzz text similarity and record deduplication service.
import { fuzz } from 'rapidfuzz';

export function deduplicateRecords<T extends Record<string, any>>(
  records: T[],
  matchKey: keyof T,
  threshold = 85
): T[] {
  const result: T[] = [];
  for (const record of records) {
    const val = String(record[matchKey] || '');
    const isDuplicate = result.some(
      (existing) => fuzz.ratio(String(existing[matchKey]), val) >= threshold
    );
    if (!isDuplicate) {
      result.push(record);
    }
  }
  return result;
}
