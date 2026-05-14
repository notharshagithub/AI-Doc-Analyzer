import express, { Request, Response } from 'express';
import multer from 'multer';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import { config } from './config';
import { ingestDocument } from './pipeline';
import { generateGroundedAnswer } from './answerGenerator';
import {
  clearCollectionPoints,
  deleteDocumentChunks,
  ensureCollectionExists,
  getCollectionStats,
  listIndexedDocuments,
} from './qdrant';
import { AppStatus } from './types';

const app = express();
let uploadDir = path.join(process.cwd(), 'uploads');
const publicDir = path.join(process.cwd(), 'public');

const isServerless = Boolean(
  process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NOW_REGION ||
    process.env.FUNCTIONS_WORKER_RUNTIME,
);

if (isServerless) {
  uploadDir = path.join('/tmp', 'uploads');
}

// Create uploads directory if it doesn't exist
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (error: any) {
  const shouldFallback =
    (error?.code === 'EROFS' || error?.code === 'EACCES') && uploadDir !== path.join('/tmp', 'uploads');

  if (!shouldFallback) {
    throw error;
  }

  uploadDir = path.join('/tmp', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = new Set(['.pdf', '.txt']);
    const allowedMimes = new Set([
      'application/pdf',
      'text/plain',
      'application/octet-stream',
      '',
    ]);

    if (allowedExtensions.has(extension) && (allowedMimes.has(file.mimetype) || !file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and TXT files are allowed'));
    }
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));

// Routes
app.post('/api/upload', (req: Request, res: Response) => {
  upload.single('file')(req, res, async (uploadError?: any) => {
    let uploadedFilePath: string | null = null;

    try {
      if (uploadError) {
        if (uploadError instanceof multer.MulterError && uploadError.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File is too large. Maximum size is 10MB.' });
        }

        return res.status(400).json({
          error: uploadError.message || 'Upload failed',
        });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      uploadedFilePath = req.file.path;
      const filePath = req.file.path;
      const filename = req.file.originalname;

      console.log(`\nFile uploaded: ${filename}`);

      // Ingest document
      const result = await ingestDocument(filePath, filename);

      res.json({
        success: true,
        message: `Document "${filename}" ingested successfully`,
        chunksCreated: result.chunks.length,
        filename,
        document: result.document,
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      res.status(500).json({
        error: error.message || 'Error processing document',
      });
    } finally {
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        fs.unlinkSync(uploadedFilePath);
      }
    }
  });
});

app.post('/api/chat', express.json(), async (req: Request, res: Response) => {
  try {
    const { query, documentId } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`\nProcessing query: ${query}`);

    // Generate answer with retrieval
    const result = await generateGroundedAnswer(query, {
      documentId: typeof documentId === 'string' && documentId.trim() ? documentId : undefined,
      topK: 6,
    });

    res.json({
      success: true,
      answer: result.answer,
      confidence: result.confidence,
      sources: result.sources,
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: error.message || 'Error processing query',
    });
  }
});

app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    await ensureCollectionExists();
    const documents = await listIndexedDocuments();
    const stats = await getCollectionStats();
    const status: AppStatus = {
      status: 'ok',
      activeDocuments: documents.length,
      totalChunks: stats.points_count || 0,
      qdrantConfigured: Boolean(config.qdrantUrl),
      modelProvider: config.useOpenRouter ? 'openrouter' : 'gemini',
    };

    res.json(status);
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error.message || 'Health check failed',
    });
  }
});

app.get('/api/documents', async (_req: Request, res: Response) => {
  try {
    await ensureCollectionExists();
    const documents = await listIndexedDocuments();
    res.json({
      success: true,
      documents,
    });
  } catch (error: any) {
    console.error('Documents error:', error);
    res.status(500).json({
      error: error.message || 'Error fetching documents',
    });
  }
});

app.delete('/api/documents/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    await deleteDocumentChunks(documentId);
    res.json({
      success: true,
      documentId,
    });
  } catch (error: any) {
    console.error('Delete document error:', error);
    res.status(500).json({
      error: error.message || 'Error deleting document',
    });
  }
});

app.delete('/api/documents', async (_req: Request, res: Response) => {
  try {
    await clearCollectionPoints();
    res.json({
      success: true,
    });
  } catch (error: any) {
    console.error('Clear documents error:', error);
    res.status(500).json({
      error: error.message || 'Error clearing documents',
    });
  }
});

app.get('/api/status', async (_req: Request, res: Response) => {
  try {
    await ensureCollectionExists();
    const documents = await listIndexedDocuments();
    const stats = await getCollectionStats();

    res.json({
      success: true,
      provider: config.useOpenRouter ? 'OpenRouter' : 'Gemini',
      qdrantUrl: config.qdrantUrl,
      port: config.port,
      documents: documents.length,
      totalChunks: stats.points_count || 0,
    });
  } catch (error: any) {
    console.error('Status error:', error);
    res.status(500).json({
      error: error.message || 'Error fetching status',
    });
  }
});

app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

export function createServer() {
  return app;
}

export function startServer() {
  const server = createServer();
  const port = config.port;

  server.listen(port, () => {
    console.log(`\n🚀 NotebookLM RAG Server running on http://localhost:${port}`);
    console.log(`📝 Upload endpoint: POST http://localhost:${port}/api/upload`);
    console.log(`💬 Chat endpoint: POST http://localhost:${port}/api/chat\n`);
  });
}

export default app;
