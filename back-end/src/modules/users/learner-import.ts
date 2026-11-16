import { BadRequestException } from '@nestjs/common';
import { parseCsv } from '../institutes/csv';

const fields = ['firstName', 'lastName', 'email', 'institution', 'studentId'] as const;
export type LearnerImportRow = Partial<Record<typeof fields[number], string>>;

export function parseLearnerList(text: string, pdf: boolean): LearnerImportRow[] {
  let rows: Record<string, string>[];
  try {
    rows = parseCsv(pdf ? pdfRowsAsCsv(text) : text);
  } catch (error) {
    throw new BadRequestException(error.message);
  }
  if (!rows.length) throw new BadRequestException('Add at least one learner below the header row.');

  const headers = new Map(Object.keys(rows[0]).map(key => [key.toLowerCase().replace(/[\s_-]+/g, ''), key]));
  if (headers.size !== Object.keys(rows[0]).length) {
    throw new BadRequestException('Column names must be unique.');
  }
  if (!fields.slice(0, 3).every(field => headers.has(field.toLowerCase()))) {
    throw new BadRequestException('Use a header row with First Name, Last Name and Email columns.');
  }

  return rows.map(row => Object.fromEntries(fields.flatMap(field => {
    const value = row[headers.get(field.toLowerCase())];
    return value ? [[field, value]] : [];
  })));
}

function pdfRowsAsCsv(text: string) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const header = lines[0] || '';
  const isRepeatedHeader = (line: string) => line.toLowerCase() === header.toLowerCase();
  if (header.includes(',')) {
    return [header, ...lines.slice(1).filter(line => !isRepeatedHeader(line))].join('\n');
  }
  const delimiter = header.includes('|') ? /\s*\|\s*/ : /\t+| {2,}/;
  const split = (line: string) => line.split(delimiter).map(cell => cell.trim());
  const headerCells = split(header);
  if (headerCells.length < 3) {
    throw Error('Use First Name, Last Name and Email columns separated by commas or pipes in the PDF.');
  }
  return [header, ...lines.slice(1).filter(line => !isRepeatedHeader(line))].map(line => split(line)
    .map(cell => '"' + cell.replaceAll('"', '""') + '"').join(',')).join('\n');
}

export async function readGoogleSheet(link: string) {
  let source: URL;
  try {
    source = new URL(link);
  } catch {
    throw new BadRequestException('Enter a valid Google Sheets link.');
  }
  const match = source.pathname.match(/^\/spreadsheets\/d\/([\w-]{15,})(?:\/|$)/);
  const gid = source.searchParams.get('gid') || new URLSearchParams(source.hash.slice(1)).get('gid') || '0';
  if (source.origin !== 'https://docs.google.com' || !match || !/^\d{1,20}$/.test(gid)) {
    throw new BadRequestException('Enter a Google Sheets link from docs.google.com.');
  }
  let url = new URL(`https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`);
  const signal = AbortSignal.timeout(10000);
  try {
    for (let i = 0; i < 4; i++) {
      const response = await fetch(url, { redirect: 'manual', signal });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) break;
        url = new URL(location, url);
        if (url.protocol !== 'https:' || url.port || url.username || url.password ||
            !(url.hostname === 'docs.google.com' || /^doc-[\w-]+-sheets\.googleusercontent\.com$/.test(url.hostname))) break;
        continue;
      }
      if (!response.ok || !response.body || /html/i.test(response.headers.get('content-type') || '')) {
        await response.body?.cancel();
        break;
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1024 * 1024) {
          await reader.cancel();
          throw new BadRequestException('The Google Sheet export exceeds 1 MB.');
        }
        chunks.push(value);
      }
      return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    }
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
  }
  throw new BadRequestException('Could not read this Google Sheet. Upload its CSV export if the sheet is private or unavailable.');
}
