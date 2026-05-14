import { extractText } from './textExtractor';
import { createChunks } from './chunking';
import { batchGenerateEmbeddings } from './gemini';
import { ensureCollectionExists, storeChunksBatch } from './qdrant';
import { Chunk, IngestedDocument } from './types';

const MAX_DOCUMENT_CHARACTERS = 90000;
const MAX_DOCUMENT_CHUNKS = 80;

export interface IngestDocumentResult {
  document: IngestedDocument;
  chunks: Chunk[];
}

export async function ingestDocument(filePath: string, originalFilename?: string): Promise<IngestDocumentResult> {
  console.log(`\nStarting document ingestion for: ${filePath}`);

  // Step 1: Extract text
  console.log('Step 1: Extracting text from document...');
  const document = await extractText(filePath, originalFilename);
  console.log(`  ✓ Extracted ${document.content.length} characters`);

  if (!document.content.trim()) {
    throw new Error('The uploaded document appears to be empty or unreadable');
  }

  if (document.content.length > MAX_DOCUMENT_CHARACTERS) {
    throw new Error(
      `Document is too large to process smoothly. Limit is ${MAX_DOCUMENT_CHARACTERS.toLocaleString()} extracted characters. Please split the file into smaller parts.`
    );
  }

  // Step 2: Create chunks
  console.log('Step 2: Creating chunks with overlap...');
  const chunks = createChunks(document);
  console.log(`  ✓ Created ${chunks.length} chunks`);

  if (chunks.length > MAX_DOCUMENT_CHUNKS) {
    throw new Error(
      `Document is too large to process smoothly. Limit is ${MAX_DOCUMENT_CHUNKS} chunks after extraction. Please split the file into smaller parts.`
    );
  }

  // Step 3: Ensure Qdrant collection exists
  console.log('Step 3: Ensuring Qdrant collection exists...');
  await ensureCollectionExists();
  console.log('  ✓ Collection ready');

  // Step 4: Generate embeddings for all chunks
  console.log('Step 4: Generating embeddings...');
  const chunkTexts = chunks.map(chunk => chunk.content);
  const embeddings = await batchGenerateEmbeddings(chunkTexts);
  console.log(`  ✓ Generated ${embeddings.length} embeddings`);

  // Step 5: Store in Qdrant
  console.log('Step 5: Storing chunks in Qdrant...');
  const chunkEmbeddingPairs = chunks.map((chunk, index) => ({
    chunk,
    embedding: embeddings[index],
  }));
  await storeChunksBatch(chunkEmbeddingPairs);
  console.log(`  ✓ Stored ${chunks.length} chunks in vector database`);

  console.log('\n✅ Document ingestion completed!\n');
  return {
    document: {
      id: document.id,
      filename: document.filename,
      sourceType: document.sourceType,
      uploadedAt: document.uploadedAt.toISOString(),
      charCount: document.content.length,
      chunkCount: chunks.length,
    },
    chunks,
  };
}
