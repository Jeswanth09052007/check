import { BadRequestException } from '@nestjs/common';
import { extname } from 'node:path';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export const importFileOptions: MulterOptions = {
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1, fieldSize: 2048 },
};

export type ImportFile = { originalname: string; buffer: Buffer };

export async function documentText(file: ImportFile, extensions: string[]) {
  const ext = extname(file?.originalname || '').toLowerCase();
  if (!file?.buffer?.length || !extensions.includes(ext)) {
    throw new BadRequestException(`Choose a nonempty ${extensions.join(', ')} file.`);
  }

  let text: string;
  try {
    if (ext === '.pdf') {
      if (file.buffer.subarray(0, 5).toString() !== '%PDF-') throw Error();
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(file.buffer), isEvalSupported: false });
      try {
        const result = await parser.getText({ first: 40, pageJoiner: '' });
        if (result.total > 40) throw new BadRequestException('Import a PDF of 40 pages or fewer.');
        text = result.pages.map(page => page.text).join('\n');
      } finally {
        await parser.destroy();
      }
    } else if (ext === '.csv') {
      text = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
    } else {
      const signature = file.buffer.subarray(0, 4).toString('hex');
      if (signature !== (ext === '.doc' ? 'd0cf11e0' : '504b0304')) throw Error();
      const WordExtractor = require('word-extractor');
      text = (await new WordExtractor().extract(file.buffer)).getBody();
    }
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('Could not read this file. Check its format and remove any password protection.');
  }
  if (!text?.trim()) throw new BadRequestException('No text found. Use a text-based file with selectable text.');
  if (text.length > 1024 * 1024) throw new BadRequestException('The extracted text exceeds 1 MB.');
  return text;
}
