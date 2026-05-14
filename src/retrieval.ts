import { generateEmbedding } from './gemini';
import { retrieveChunks } from './qdrant';
import { RetrievalResult } from './types';

export interface RetrievalOptions {
  topK?: number;
  documentId?: string;
}

export async function retrieveRelevantChunks(query: string, options: RetrievalOptions = {}): Promise<RetrievalResult[]> {
  try {
    const topK = options.topK ?? 5;

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Retrieve top-k similar chunks from Qdrant
    const results = await retrieveChunks(queryEmbedding, topK, options.documentId);

    if (results.length === 0) {
      return [];
    }

    // Summary-style and scoped queries naturally score lower than direct fact lookups.
    const minimumScore = options.documentId ? 0.08 : 0.12;
    const filteredResults = results.filter(result => result.score >= minimumScore);

    return filteredResults.length > 0 ? filteredResults : results.slice(0, Math.min(3, results.length));
  } catch (error) {
    console.error('Error retrieving relevant chunks:', error);
    throw error;
  }
}

export function buildContextString(retrievalResults: RetrievalResult[]): string {
  if (retrievalResults.length === 0) {
    return '';
  }

  const contextParts = retrievalResults.map((result, index) => {
    const { chunk } = result;
    const source = chunk.pageNumber ? `[${chunk.filename}, Page ${chunk.pageNumber}]` : `[${chunk.filename}]`;
    return `${source}:\n${chunk.content}`;
  });

  return contextParts.join('\n\n---\n\n');
}

export function formatRetrievalResults(retrievalResults: RetrievalResult[]): string {
  if (retrievalResults.length === 0) {
    return 'No relevant information found in the document.';
  }

  const summary = retrievalResults
    .map((result, index) => {
      const { chunk, score } = result;
      const confidence = Math.round(score * 100);
      return `${index + 1}. [${chunk.filename}${chunk.pageNumber ? `, Page ${chunk.pageNumber}` : ''}] (${confidence}% match)`;
    })
    .join('\n');

  return `Found ${retrievalResults.length} relevant chunk(s):\n${summary}`;
}
