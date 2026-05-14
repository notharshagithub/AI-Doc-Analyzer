import { config, validateConfig } from './config';
import { startServer } from './server';

async function main() {
  try {
    // Validate configuration
    validateConfig();

    console.log('🔧 Configuration loaded successfully');
    console.log(`   GEMINI_API_KEY: ${config.geminiApiKey.substring(0, 10)}...`);
    console.log(`   QDRANT_URL: ${config.qdrantUrl}`);
    console.log(`   PORT: ${config.port}`);
    console.log(`   NODE_ENV: ${config.nodeEnv}`);

    // Start the server
    startServer();
  } catch (error: any) {
    console.error('❌ Startup error:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  process.exit(0);
});

main();
