import fs from 'fs';
import readline from 'readline';

async function run() {
  const fileStream = fs.createReadStream('C:\\Users\\consu\\.gemini\\antigravity-ide\\brain\\94b119e9-1605-4bd8-8fad-8aadd01c6f8e\\.system_generated\\logs\\transcript.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("SEARCH RESULTS:");
  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    if (line.toLowerCase().includes('forgot-password') || line.toLowerCase().includes('forgotpassword')) {
      // Print first 200 characters of the match
      console.log(`Line ${lineCount}: ${line.substring(0, 300)}...`);
    }
  }
}

run();
