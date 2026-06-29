export type ParsedLevel = {
  id: string;
  level: string;
  sb: string;
  bb: string;
  ante: string;
  minutes: string;
};

// Lines that should never be treated as level data
const SKIP_RE = /^(break|dinner|registration|chip[\s-]?race|chip[\s-]?up|staff|day\s+\d|event|color[\s-]?up|re[\s-]?entry|rebuy)/i;

function extractLevelsFromLines(lines: string[]): ParsedLevel[] {
  const result: ParsedLevel[] = [];
  const seen = new Set<number>();

  for (const line of lines) {
    if (SKIP_RE.test(line)) continue;

    // Pull all positive integers from the line (handle 1,000 style)
    const nums = [...line.matchAll(/\b(\d{1,3}(?:,\d{3})*|\d+)\b/g)]
      .map((m) => parseInt(m[1].replace(/,/g, ''), 10))
      .filter((n) => n > 0 && n < 10_000_000);

    if (nums.length < 3) continue;

    // Expect first number to be a level (1–200)
    const levelNum = nums[0];
    if (levelNum < 1 || levelNum > 200) continue;

    const sb = nums[1];
    const bb = nums[2];

    // BB must be ≥ SB and blinds must be meaningful
    if (bb < sb || sb <= 0 || bb < 25) continue;

    const ante = nums.length > 3 ? nums[3] : 0;
    const minutes = nums.length > 4 ? nums[4] : undefined;

    if (seen.has(levelNum)) continue;
    seen.add(levelNum);

    result.push({
      id: String(result.length),
      level: String(levelNum),
      sb: String(sb),
      bb: String(bb),
      ante: String(ante),
      minutes: minutes !== undefined ? String(minutes) : '',
    });
  }

  return result;
}

export async function parsePdfFile(file: File): Promise<ParsedLevel[]> {
  // Lazy-load pdfjs-dist to keep it out of the main bundle
  const pdfjsLib = await import('pdfjs-dist');

  // Use unpkg CDN for the worker — user has network when uploading a file
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  // Group text items by Y-position to reconstruct table rows
  type Item = { str: string; x: number; y: number };
  const allItems: Item[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      allItems.push({
        str: item.str,
        x: item.transform[4],
        y: Math.round(item.transform[5] / 4) * 4, // bucket by 4pt tolerance
      });
    }
  }

  if (allItems.length === 0) return [];

  // Rebuild lines sorted top-to-bottom (PDF Y is bottom-up so sort descending)
  const byY = new Map<number, Item[]>();
  for (const item of allItems) {
    const bucket = byY.get(item.y) ?? [];
    bucket.push(item);
    byY.set(item.y, bucket);
  }

  const lines = [...byY.entries()]
    .sort((a, b) => b[0] - a[0]) // top-to-bottom
    .map(([, items]) =>
      items
        .sort((a, b) => a.x - b.x)
        .map((i) => i.str)
        .join(' ')
        .trim()
    )
    .filter((l) => l.length > 0);

  return extractLevelsFromLines(lines);
}
