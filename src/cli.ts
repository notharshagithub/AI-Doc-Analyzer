import * as readline from 'readline';
import * as path from 'path';
import { config, validateConfig } from './config';
import { ingestDocument } from './pipeline';
import { generateGroundedAnswer, formatAnswerForDisplay } from './answerGenerator';
import { getCollectionStats } from './qdrant';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

async function main() {
  try {
    validateConfig();

    console.log('\n' + '='.repeat(80));
    console.log('📚 NotebookLM RAG - CLI Interface');
    console.log('='.repeat(80) + '\n');

    let currentDocumentId: string | null = null;
    let currentDocumentName: string | null = null;

    while (true) {
      console.log('\nOptions:');
      console.log('  1. Upload and ingest a document (PDF or TXT)');
      console.log('  2. Ask a question about the document');
      console.log('  3. View collection stats');
      console.log('  4. Exit\n');

      const choice = await prompt('Choose an option (1-4): ');

      if (choice === '1') {
        // Upload document
        const filePath = await prompt('Enter the path to the PDF or TXT file: ');

        if (!filePath) {
          console.log('❌ Please provide a valid file path');
          continue;
        }

        try {
          const result = await ingestDocument(filePath, path.basename(filePath));
          currentDocumentId = result.document.id;
          currentDocumentName = result.document.filename;
          console.log(`✅ Document loaded with ${result.document.chunkCount} chunks. Ready for questions!`);
        } catch (error: any) {
          console.log(`❌ Error: ${error.message}`);
        }
      } else if (choice === '2') {
        // Ask question
        if (!currentDocumentId) {
          console.log('⚠️  Please upload a document first');
          continue;
        }

        const query = await prompt('\nWhat would you like to know about the document?\n> ');

        if (!query) {
          console.log('❌ Please provide a question');
          continue;
        }

        try {
          console.log('\n🔍 Searching and generating answer...\n');
          const result = await generateGroundedAnswer(query, {
            documentId: currentDocumentId,
          });
          if (currentDocumentName) {
            console.log(`Current document: ${currentDocumentName}\n`);
          }
          console.log(formatAnswerForDisplay(result));
        } catch (error: any) {
          console.log(`❌ Error: ${error.message}`);
        }
      } else if (choice === '3') {
        // View stats
        try {
          const stats = await getCollectionStats();
          console.log('\n📊 Collection Statistics:');
          console.log(`  Points count: ${stats.points_count}`);
          console.log(`  Vector count: ${stats.vectors_count}`);
          console.log(`  Status: ${stats.status}\n`);
        } catch (error: any) {
          console.log(`⚠️  Stats: ${error.message}`);
        }
      } else if (choice === '4') {
        // Exit
        console.log('\n👋 Goodbye!\n');
        rl.close();
        break;
      } else {
        console.log('❌ Invalid option. Please choose 1-4.');
      }
    }
  } catch (error: any) {
    console.error(`❌ Fatal error: ${error.message}`);
    rl.close();
    process.exit(1);
  }
}

main();
