// process-docs.js
import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai"; // ✅ correct package
import { fileURLToPath } from "url";
import process from "process";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Init Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

// 2. Init Gemini
const ai = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY);

// --- Helper: wait function ---
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Helper: generate embedding with retries ---
async function getEmbedding(text, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const embeddingModel = ai.getGenerativeModel({ model: "text-embedding-004" });
      const response = await embeddingModel.embedContent(text);

      return response.embedding.values;
    } catch (err) {
      if (err.status === 429 || err.message?.includes("RESOURCE_EXHAUSTED")) {
        const delay = attempt * 2000;
        console.warn(
          `⚠️ Rate limit hit (attempt ${attempt}/${retries}). Retrying in ${
            delay / 1000
          }s...`
        );
        await sleep(delay);
      } else {
        console.error("❌ Gemini embedding error:", err);
        return null;
      }
    }
  }

  console.error("❌ Failed after retries. Skipping this chunk.");
  return null;
}

// --- Helper: chunk text ---
function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }

  return chunks;
}

// --- Main: process docs ---
async function processDocs() {
  const docsDir = "./docs";
  const files = fs.readdirSync(docsDir).filter((f) => f.endsWith(".docx"));

  for (const file of files) {
    console.log(`📄 Processing: ${file}`);
    const filePath = path.join(docsDir, file);

    // Convert .docx → plain text
    const { value: text } = await mammoth.extractRawText({ path: filePath });
    const chunks = chunkText(text);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk.trim()) continue;

      // 🚀 Get embedding + insert/update
      const embedding = await getEmbedding(chunk);

      if (!embedding) {
        console.warn(
          `⚠️ Skipping chunk ${i + 1} of ${file} (embedding failed)`
        );
        continue;
      }

      const { error: insertError } = await supabase
        .from("chatbot_chunks")
        .upsert(
          {
            doc_name: file,
            chunk_index: i,
            content: chunk,
            embedding,
          },
          { onConflict: ["doc_name", "chunk_index"] } // ✅ handles duplicates
        );

      if (insertError) {
        console.error("❌ Error inserting chunk:", insertError);
      } else {
        console.log(`✅ Upserted chunk ${i + 1}/${chunks.length} from ${file}`);
      }

      // 💤 small delay between chunks
      await sleep(500);
    }
  }

  console.log("🎉 All docs processed and stored in Supabase!");
}

processDocs();
