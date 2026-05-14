import { config } from './config';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const EMBEDDINGS_MODEL = 'openai/text-embedding-3-small';
const CHAT_MODEL = 'deepseek/deepseek-chat';

/**
 * Generate an embedding for a single text using OpenRouter Jina embeddings
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!config.useOpenRouter) {
    throw new Error('OpenRouter is not enabled. Set USE_OPENROUTER=true in .env');
  }

  if (!config.openrouterApiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openrouterApiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDINGS_MODEL,
        input: text,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenRouter API error:', response.status, errorData);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorData}`);
    }

    const data = (await response.json()) as any;
    
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      throw new Error('Invalid embedding response format from OpenRouter');
    }

    // Extract embedding vector from response
    const embedding = data.data[0].embedding;
    
    if (!Array.isArray(embedding)) {
      throw new Error('Invalid embedding vector in response');
    }

    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Generate an answer using OpenRouter DeepSeek chat model
 */
export async function generateAnswer(prompt: string, context: string): Promise<string> {
  if (!config.useOpenRouter) {
    throw new Error('OpenRouter is not enabled. Set USE_OPENROUTER=true in .env');
  }

  if (!config.openrouterApiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const systemInstruction = `You are a document-grounded assistant.
Answer ONLY from the provided context.
If the user asks for a summary, overview, or key points, summarize the provided context directly.
If the context does not contain enough information to answer the question, respond with exactly: "Not found in the document"
Do not use outside knowledge. Be concise, direct, and faithful to the context.`;

  const userMessage = `CONTEXT:
${context}

QUESTION:
${prompt}`;

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openrouterApiKey}`,
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          {
            role: 'system',
            content: systemInstruction,
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
        temperature: 0.2,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenRouter API error:', response.status, errorData);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorData}`);
    }

    const data = (await response.json()) as any;

    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error('Invalid chat response format from OpenRouter');
    }

    const content = data.choices[0].message?.content;
    
    if (!content) {
      throw new Error('No content in chat response');
    }

    return content;
  } catch (error) {
    console.error('Error generating answer:', error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts with rate limiting
 */
export async function batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  // Process texts sequentially with rate limiting to avoid exceeding API limits
  for (const text of texts) {
    try {
      const embedding = await generateEmbedding(text);
      embeddings.push(embedding);
      
      // Add a small delay between requests to avoid rate limiting
      // OpenRouter typically has generous limits, but this is safe practice
      if (texts.indexOf(text) < texts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error(`Error generating embedding for text chunk: ${text.substring(0, 50)}...`, error);
      // Continue processing other texts, but track the error
      throw error;
    }
  }

  return embeddings;
}
