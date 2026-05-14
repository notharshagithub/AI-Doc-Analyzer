import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from './config';
import { Chunk, IngestedDocument, RetrievalResult } from './types';

let client: QdrantClient | null = null;
const COLLECTION_NAME = 'documents';
const VECTOR_SIZE = 1536; // openai/text-embedding-3-small returns 1536-dimensional vectors

interface ScrollPointPayload {
  id: string;
  documentId: string;
  content: string;
  filename: string;
  pageNumber?: number;
  chunkIndex: number;
  sourceType: 'pdf' | 'txt';
  uploadedAt: string;
}

function parsePayload(payload: unknown): ScrollPointPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.documentId !== 'string' ||
    typeof record.content !== 'string' ||
    typeof record.filename !== 'string' ||
    typeof record.chunkIndex !== 'number' ||
    typeof record.sourceType !== 'string' ||
    typeof record.uploadedAt !== 'string'
  ) {
    return null;
  }

  return {
    id: record.id,
    documentId: record.documentId,
    content: record.content,
    filename: record.filename,
    pageNumber: typeof record.pageNumber === 'number' ? record.pageNumber : undefined,
    chunkIndex: record.chunkIndex,
    sourceType: record.sourceType === 'pdf' ? 'pdf' : 'txt',
    uploadedAt: record.uploadedAt,
  };
}

export function initializeQdrant(): QdrantClient {
  if (!client) {
    client = new QdrantClient({
      url: config.qdrantUrl,
      apiKey: config.qdrantApiKey || undefined,
    });
  }
  return client;
}

export async function ensureCollectionExists(): Promise<void> {
  const qdrant = initializeQdrant();

  try {
    // Check if collection exists
    const collections = await qdrant.getCollections();
    const collectionExists = collections.collections.some(c => c.name === COLLECTION_NAME);

    if (collectionExists) {
      // Check vector size of existing collection
      try {
        const collectionInfo = await qdrant.getCollection(COLLECTION_NAME);
        const currentVectorSize = ((collectionInfo.config as any)?.params?.vectors as any)?.size;
        
        if (currentVectorSize && currentVectorSize !== VECTOR_SIZE) {
          console.log(`⚠️  Collection has wrong vector size (${currentVectorSize}), expected ${VECTOR_SIZE}`);
          console.log('Deleting and recreating collection with correct dimensions...');
          await qdrant.deleteCollection(COLLECTION_NAME);
          console.log('✓ Old collection deleted');
          
          await qdrant.createCollection(COLLECTION_NAME, {
            vectors: {
              size: VECTOR_SIZE,
              distance: 'Cosine',
            },
          });
          console.log('✓ New collection created with correct dimensions');
          await ensurePayloadIndexes(qdrant);
        }
      } catch (checkError) {
        // If we can't check dimensions, proceed - collection exists
        console.log('  ✓ Collection ready');
      }
    } else {
      console.log('Creating Qdrant collection...');
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: {
          size: VECTOR_SIZE,
          distance: 'Cosine',
        },
      });
      console.log('Collection created successfully');
      await ensurePayloadIndexes(qdrant);
    }

    await ensurePayloadIndexes(qdrant);
  } catch (error) {
    console.error('Error ensuring collection exists:', error);
    throw error;
  }
}

export async function storeChunk(chunk: Chunk, embedding: number[]): Promise<void> {
  const qdrant = initializeQdrant();

  try {
    await qdrant.upsert(COLLECTION_NAME, {
      points: [
        {
          id: hashString(chunk.id),
          vector: embedding,
          payload: {
            id: chunk.id,
            documentId: chunk.documentId,
            content: chunk.content,
            filename: chunk.filename,
            pageNumber: chunk.pageNumber || 0,
            chunkIndex: chunk.chunkIndex,
            sourceType: chunk.sourceType,
            uploadedAt: chunk.metadata.uploadedAt,
          },
        },
      ],
    });
  } catch (error) {
    console.error('Error storing chunk:', error);
    throw error;
  }
}

export async function storeChunksBatch(chunks: Array<{ chunk: Chunk; embedding: number[] }>): Promise<void> {
  const qdrant = initializeQdrant();

  try {
    const points = chunks.map(({ chunk, embedding }) => ({
      id: hashString(chunk.id),
      vector: embedding,
      payload: {
        id: chunk.id,
        documentId: chunk.documentId,
        content: chunk.content,
        filename: chunk.filename,
        pageNumber: chunk.pageNumber || 0,
        chunkIndex: chunk.chunkIndex,
        sourceType: chunk.sourceType,
        uploadedAt: chunk.metadata.uploadedAt,
      },
    }));

    await qdrant.upsert(COLLECTION_NAME, { points });
  } catch (error) {
    console.error('Error storing chunks batch:', error);
    throw error;
  }
}

export async function retrieveChunks(
  queryEmbedding: number[],
  topK: number = 5,
  documentId?: string
): Promise<RetrievalResult[]> {
  const qdrant = initializeQdrant();

  try {
    const results = await qdrant.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      limit: topK,
      with_payload: true,
      filter: documentId ? {
        must: [
          {
            key: 'documentId',
            match: {
              value: documentId,
            },
          },
        ],
      } : undefined,
    });

    return results.flatMap(result => {
      const payload = parsePayload(result.payload);
      if (!payload) {
        return [];
      }

      const chunk: Chunk = {
        id: payload.id,
        documentId: payload.documentId,
        content: payload.content,
        filename: payload.filename,
        pageNumber: payload.pageNumber,
        chunkIndex: payload.chunkIndex,
        sourceType: payload.sourceType,
        metadata: {
          documentId: payload.documentId,
          filename: payload.filename,
          pageNumber: payload.pageNumber,
          chunkIndex: payload.chunkIndex,
          sourceType: payload.sourceType,
          uploadedAt: payload.uploadedAt,
        },
      };

      return {
        chunk,
        score: result.score || 0,
      };
    });
  } catch (error) {
    console.error('Error retrieving chunks:', error);
    throw error;
  }
}

export async function deleteDocumentChunks(documentId: string): Promise<void> {
  const qdrant = initializeQdrant();

  try {
    await qdrant.delete(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: 'documentId',
            match: {
              value: documentId,
            },
          },
        ],
      },
    });
  } catch (error) {
    console.error('Error deleting document chunks:', error);
    throw error;
  }
}

export async function clearCollectionPoints(): Promise<void> {
  const qdrant = initializeQdrant();

  try {
    await qdrant.delete(COLLECTION_NAME, {
      filter: {},
    });
  } catch (error) {
    console.error('Error clearing collection points:', error);
    throw error;
  }
}

export async function getCollectionStats(): Promise<any> {
  const qdrant = initializeQdrant();

  try {
    const stats = await qdrant.getCollection(COLLECTION_NAME);
    return stats;
  } catch (error) {
    console.error('Error getting collection stats:', error);
    throw error;
  }
}

export async function listIndexedDocuments(): Promise<IngestedDocument[]> {
  const qdrant = initializeQdrant();
  const documents = new Map<string, IngestedDocument>();
  let nextPageOffset: unknown = undefined;

  try {
    do {
      const response = await qdrant.scroll(COLLECTION_NAME, {
        with_payload: true,
        with_vector: false,
        limit: 128,
        offset: (
          typeof nextPageOffset === 'string' || typeof nextPageOffset === 'number'
            ? nextPageOffset
            : undefined
        ),
      });

      for (const point of response.points) {
        const payload = parsePayload(point.payload);
        if (!payload?.documentId) {
          continue;
        }

        const existing = documents.get(payload.documentId);
        if (existing) {
          existing.chunkCount += 1;
          existing.charCount += payload.content.length;
          continue;
        }

        documents.set(payload.documentId, {
          id: payload.documentId,
          filename: payload.filename,
          sourceType: payload.sourceType,
          uploadedAt: payload.uploadedAt,
          charCount: payload.content.length,
          chunkCount: 1,
        });
      }

      nextPageOffset = response.next_page_offset;
    } while (nextPageOffset !== null && nextPageOffset !== undefined);

    return Array.from(documents.values()).sort((a, b) => (
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    ));
  } catch (error) {
    console.error('Error listing indexed documents:', error);
    throw error;
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

async function ensurePayloadIndexes(qdrant: QdrantClient): Promise<void> {
  try {
    await qdrant.createPayloadIndex(COLLECTION_NAME, {
      wait: true,
      field_name: 'documentId',
      field_schema: 'keyword',
    });
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : '';
    if (!message.toLowerCase().includes('already exists')) {
      console.warn('Warning: could not ensure documentId payload index:', message || error);
    }
  }
}
