#!/bin/bash

# Test script for NotebookLM RAG API
# Usage: ./test.sh

API_URL="http://localhost:3000"

echo "================================"
echo "NotebookLM RAG - API Test Script"
echo "================================"
echo ""

# Check if server is running
echo "1. Checking server health..."
curl -s "$API_URL/api/health" > /dev/null
if [ $? -eq 0 ]; then
  echo "✅ Server is running"
else
  echo "❌ Server is not running. Start with: npm start"
  exit 1
fi

# Create test document
echo ""
echo "2. Creating test document..."
cat > /tmp/test_rag.txt << 'EOF'
The Gemini API

The Gemini API is Google's state-of-the-art language model API. It provides access to the most advanced AI models available, including Gemini Pro for text generation and Gemini Embeddings for semantic search.

Key Features:
- Fast and efficient text processing
- High-quality embeddings with 768 dimensions
- Context window of up to 32,000 tokens
- Multimodal capabilities (text, images, audio)
- Cost-effective API pricing
- RESTful interface for easy integration

Qdrant Vector Database

Qdrant is a high-performance vector similarity search engine. It's designed for production-scale semantic search applications with support for billion-scale vector collections.

Benefits:
- Sub-millisecond search latency
- Cosine and dot product similarity metrics
- Efficient batch operations
- REST and gRPC APIs
- Docker deployment support
- Cloud and self-hosted options

RAG (Retrieval-Augmented Generation)

RAG is a technique that combines retrieval and generation to produce more accurate and grounded responses. The system retrieves relevant information from a knowledge base and uses it to generate contextual answers.

Process:
1. Document ingestion and chunking
2. Embedding generation for all chunks
3. Storage in vector database
4. Query embedding and similarity search
5. Context building from top-k results
6. Answer generation with context
7. Source attribution
EOF

echo "✅ Test document created"

# Upload document
echo ""
echo "3. Uploading test document..."
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/api/upload" \
  -F "file=@/tmp/test_rag.txt")

echo "$UPLOAD_RESPONSE" | jq '.' 2>/dev/null || echo "$UPLOAD_RESPONSE"

# Extract filename from response
CHUNKS=$(echo "$UPLOAD_RESPONSE" | jq -r '.chunksCreated // empty' 2>/dev/null)
if [ -n "$CHUNKS" ]; then
  echo "✅ Document uploaded with $CHUNKS chunks"
else
  echo "⚠️ Could not parse upload response"
fi

# Test queries
echo ""
echo "4. Testing chat queries..."
echo ""

# Query 1
echo "Query 1: What is the Gemini API?"
RESPONSE=$(curl -s -X POST "$API_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the Gemini API?"}')

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Query 2
echo "Query 2: What is Qdrant used for?"
RESPONSE=$(curl -s -X POST "$API_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"query": "What is Qdrant used for?"}')

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Query 3 - Should not be found
echo "Query 3: What is the meaning of life? (not in document)"
RESPONSE=$(curl -s -X POST "$API_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the meaning of life?"}')

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

echo "================================"
echo "✅ Test complete!"
echo "================================"
