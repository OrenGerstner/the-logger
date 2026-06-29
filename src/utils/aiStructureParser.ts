import type { ParsedLevel } from './pdfStructureParser';

const SYSTEM_PROMPT = `Extract a poker tournament blind structure from the provided image or document.
Return ONLY a JSON object — no markdown, no explanation:
{
  "name": "tournament name or empty string",
  "levels": [
    { "level": 1, "sb": 100, "bb": 200, "ante": 0, "minutes": 20 },
    { "level": 2, "sb": 150, "bb": 300, "ante": 300, "minutes": 20 }
  ]
}
Rules:
- Only include actual blind levels (rows with SB and BB numbers). Skip breaks, chip-ups, registration rows.
- All number values must be integers.
- ante is 0 if not shown.
- minutes is 0 if not shown.
- level numbers must be sequential starting from 1.`;

type RawLevel = { level: number; sb: number; bb: number; ante: number; minutes: number };

function parseAiResponse(text: string): ParsedLevel[] {
  // Strip any accidental markdown fences
  const clean = text.replace(/```[a-z]*\n?/gi, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Response did not contain JSON');

  const data = JSON.parse(match[0]) as { levels: RawLevel[] };
  if (!Array.isArray(data.levels) || data.levels.length === 0) {
    throw new Error('No levels found in response');
  }

  return data.levels.map((l, i) => ({
    id: String(i),
    level: String(l.level ?? i + 1),
    sb: String(l.sb ?? 0),
    bb: String(l.bb ?? 0),
    ante: String(l.ante ?? 0),
    minutes: l.minutes ? String(l.minutes) : '',
  }));
}

export async function parseImageWithAI(
  file: File,
  apiKey: string
): Promise<ParsedLevel[]> {
  // Read image as base64
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // strip data:...;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const mediaType = (file.type || 'image/jpeg') as
    | 'image/jpeg'
    | 'image/png'
    | 'image/gif'
    | 'image/webp';

  // Direct fetch to Anthropic — avoids needing to bundle the SDK
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            { type: 'text', text: 'Extract the blind structure from this tournament schedule.' },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `API error ${res.status}`);
  }

  const json = (await res.json()) as { content: Array<{ type: string; text: string }> };
  const text = json.content.find((c) => c.type === 'text')?.text ?? '';
  return parseAiResponse(text);
}
