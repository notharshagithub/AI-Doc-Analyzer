import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import pdf from 'pdf-parse';
import { Document } from './types';

export async function extractTextFromPDF(filePath: string, filename: string): Promise<Document> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data: any = await pdf(dataBuffer);

    let text = '';
    if (data.text) {
      text = data.text;
    } else if (data.pages && Array.isArray(data.pages)) {
      text = data.pages.map((page: any) => page.content || '').join('\n\n');
    }

    return {
      id: randomUUID(),
      filename,
      content: text,
      sourceType: 'pdf',
      uploadedAt: new Date(),
    };
  } catch (error) {
    console.error('Error extracting PDF:', error);
    throw error;
  }
}

export async function extractTextFromTxt(filePath: string, filename: string): Promise<Document> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    return {
      id: randomUUID(),
      filename,
      content,
      sourceType: 'txt',
      uploadedAt: new Date(),
    };
  } catch (error) {
    console.error('Error extracting TXT:', error);
    throw error;
  }
}

export async function extractText(filePath: string, originalFilename?: string): Promise<Document> {
  const filename = originalFilename || path.basename(filePath);
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.pdf') {
    return extractTextFromPDF(filePath, filename);
  } else if (extension === '.txt') {
    return extractTextFromTxt(filePath, filename);
  } else {
    throw new Error(`Unsupported file type: ${extension}`);
  }
}

export function getPageNumber(text: string, chunkStartIndex: number): number {
  // Simple heuristic: count form feed characters and newline groups as pages
  const textBefore = text.substring(0, chunkStartIndex);
  const pageMarkers = (textBefore.match(/\f/g) || []).length;
  return Math.max(1, pageMarkers + 1);
}
