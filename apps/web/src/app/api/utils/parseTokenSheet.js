/**
 * parseTokenSheet(buffer) — reads an Excel/CSV file containing QR token
 * strings and extracts them.
 *
 * Supports two shapes:
 *   - a single bare column of tokens, no header row
 *   - a multi-column sheet (e.g. serial_number, token, filename, filepath,
 *     decoded_token, decode_match, created_at) — the token column is picked
 *     by header name. `decoded_token` wins over `token` when both exist,
 *     since it's the value actually read back off the generated QR image.
 *
 * Used by the imported-QR import flow — the file is expected to list tokens
 * already printed/issued outside Traheeb.
 */
import XLSX from 'xlsx';

const TOKEN_COLUMN_PRIORITY = ['decoded_token', 'token', 'code', 'qr', 'رمز', 'الرمز', 'الكود'];

function findTokenColumn(headerRow) {
  const headers = headerRow.map((h) => String(h ?? '').trim().toLowerCase());
  for (const candidate of TOKEN_COLUMN_PRIORITY) {
    const idx = headers.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  // Fallback: first header containing one of the keywords anywhere
  for (const candidate of TOKEN_COLUMN_PRIORITY) {
    const idx = headers.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
}

export function parseTokenSheet(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // header: 1 → rows as arrays, not objects — the sheet may have no header row
  const rows = sheet ? XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) : [];

  const seen = new Set();
  const tokens = [];
  let skipped = 0;

  if (!rows.length) return { tokens, skipped };

  const headerColIdx = findTokenColumn(rows[0]);
  const colIdx = headerColIdx !== -1 ? headerColIdx : 0;
  const startRow = headerColIdx !== -1 ? 1 : 0;

  for (let i = startRow; i < rows.length; i++) {
    const raw = String(rows[i]?.[colIdx] ?? '').trim();
    if (!raw) continue;

    if (seen.has(raw)) {
      skipped++;
      continue;
    }
    seen.add(raw);
    tokens.push(raw);
  }

  return { tokens, skipped };
}

export default parseTokenSheet;
