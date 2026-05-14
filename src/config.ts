import dotenv from 'dotenv';

dotenv.config();

export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  useOpenRouter: process.env.USE_OPENROUTER === 'true',
  qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
  qdrantApiKey: process.env.QDRANT_API_KEY || '',
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
};

export function validateConfig(): void {
  if (config.useOpenRouter) {
    if (!config.openrouterApiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is not set when USE_OPENROUTER=true');
    }
  } else {
    if (!config.geminiApiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
  }
}
