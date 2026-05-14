import { Chunk, Document } from './types';
import { getPageNumber } from './textExtractor';
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 240;

export function createChunks(document: Document): Chunk[] {
  const chunks: Chunk[] = [];
  const text = document.content;
  
  let chunkIndex = 0;
  let currentIndex = 0;

  while (currentIndex < text.length) {
    const chunkEnd = Math.min(currentIndex + CHUNK_SIZE, text.length);
    const chunkContent = text.substring(currentIndex, chunkEnd).trim();

    if (chunkContent.length > 0) {
      const pageNumber = getPageNumber(text, currentIndex);
      const chunk: Chunk = {
        id: `${document.id}-chunk-${chunkIndex}`,
        documentId: document.id,
        content: chunkContent,
        filename: document.filename,
        pageNumber,
        chunkIndex,
        sourceType: document.sourceType,
        metadata: {
          documentId: document.id,
          filename: document.filename,
          pageNumber,
          chunkIndex,
          sourceType: document.sourceType,
          uploadedAt: document.uploadedAt.toISOString(),
        },
      };

      chunks.push(chunk);
      chunkIndex++;
    }

    // Move to next chunk with overlap
    currentIndex += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

export function splitTextByParagraphs(text: string, minChunkSize: number = 500): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if ((currentChunk + '\n\n' + paragraph).length < minChunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = paragraph;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
