import { generateAnswer } from './gemini';
import { retrieveRelevantChunks, buildContextString, RetrievalOptions } from './retrieval';
import { Answer, RetrievalResult } from './types';

export async function generateGroundedAnswer(query: string, options: RetrievalOptions = {}): Promise<Answer> {
  try {
    // Step 1: Retrieve relevant chunks
    const retrievalResults = await retrieveRelevantChunks(query, options);

    // Step 2: Build context from retrieved chunks
    const context = buildContextString(retrievalResults);

    // Step 3: Generate answer with context
    let answer = '';
    if (retrievalResults.length === 0) {
      answer = 'Not found in the document';
    } else {
      answer = await generateAnswer(query, context);
      if (answer.trim().toLowerCase() === 'not found in the document') {
        answer = buildFallbackAnswer(query, retrievalResults);
      }
    }

    // Step 4: Determine confidence level
    const confidence = determineConfidence(answer, retrievalResults);

    // Step 5: Format sources
    const sources = formatSources(retrievalResults);

    return {
      answer,
      sources,
      confidence,
    };
  } catch (error) {
    console.error('Error generating answer:', error);
    throw error;
  }
}

function buildFallbackAnswer(query: string, retrievalResults: RetrievalResult[]): string {
  if (retrievalResults.length === 0) {
    return 'Not found in the document';
  }

  const summaryIntent = /\b(summary|summarize|overview|key points|main points|what is this document about)\b/i.test(query);
  const excerpts = retrievalResults
    .slice(0, 3)
    .map(result => result.chunk.content.trim())
    .filter(Boolean);

  if (summaryIntent) {
    const snippet = excerpts
      .join(' ')
      .replace(/\s+/g, ' ')
      .slice(0, 700)
      .trim();

    return snippet || 'Not found in the document';
  }

  const strongest = excerpts[0]
    ?.replace(/\s+/g, ' ')
    .slice(0, 500)
    .trim();

  return strongest || 'Not found in the document';
}

function determineConfidence(answer: string, retrievalResults: RetrievalResult[]): 'high' | 'medium' | 'low' {
  if (answer.toLowerCase().includes('not found in the document')) {
    return 'low';
  }

  if (retrievalResults.length === 0) {
    return 'low';
  }

  const avgScore = retrievalResults.reduce((sum, r) => sum + r.score, 0) / retrievalResults.length;

  if (avgScore > 0.7 && retrievalResults.length >= 3) {
    return 'high';
  } else if (avgScore > 0.5 || retrievalResults.length >= 2) {
    return 'medium';
  } else {
    return 'low';
  }
}

function formatSources(retrievalResults: RetrievalResult[]): Array<{
  documentId: string;
  filename: string;
  pageNumber?: number;
  chunkIndex: number;
  content: string;
  score: number;
}> {
  return retrievalResults.map(result => ({
    documentId: result.chunk.documentId,
    filename: result.chunk.filename,
    pageNumber: result.chunk.pageNumber,
    chunkIndex: result.chunk.chunkIndex,
    content: result.chunk.content.substring(0, 200) + (result.chunk.content.length > 200 ? '...' : ''),
    score: result.score,
  }));
}

export function formatAnswerForDisplay(answer: Answer): string {
  let output = '\n' + '='.repeat(80) + '\n';
  output += 'ANSWER:\n';
  output += '='.repeat(80) + '\n';
  output += answer.answer + '\n\n';

  output += '-'.repeat(80) + '\n';
  output += `SOURCES (Confidence: ${answer.confidence.toUpperCase()}):\n`;
  output += '-'.repeat(80) + '\n';

  answer.sources.forEach((source, index) => {
    const pageInfo = source.pageNumber ? ` | Page ${source.pageNumber}` : '';
    output += `\n${index + 1}. ${source.filename}${pageInfo}\n`;
    output += `   Chunk ${source.chunkIndex}:\n`;
    output += `   "${source.content}"\n`;
  });

  output += '\n' + '='.repeat(80) + '\n';
  return output;
}
