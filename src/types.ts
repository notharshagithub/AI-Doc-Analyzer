export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  filename: string;
  pageNumber?: number;
  chunkIndex: number;
  sourceType: 'pdf' | 'txt';
  metadata: {
    documentId: string;
    filename: string;
    pageNumber?: number;
    chunkIndex: number;
    sourceType: 'pdf' | 'txt';
    uploadedAt: string;
  };
}

export interface Document {
  id: string;
  filename: string;
  content: string;
  sourceType: 'pdf' | 'txt';
  uploadedAt: Date;
}

export interface RetrievalResult {
  chunk: Chunk;
  score: number;
  embedding?: number[];
}

export interface Answer {
  answer: string;
  sources: Array<{
    documentId: string;
    filename: string;
    pageNumber?: number;
    chunkIndex: number;
    content: string;
    score: number;
  }>;
  confidence: 'high' | 'medium' | 'low';
}

export interface IngestedDocument {
  id: string;
  filename: string;
  sourceType: 'pdf' | 'txt';
  uploadedAt: string;
  charCount: number;
  chunkCount: number;
}

export interface AppStatus {
  status: 'ok';
  activeDocuments: number;
  totalChunks: number;
  qdrantConfigured: boolean;
  modelProvider: 'openrouter' | 'gemini';
}
