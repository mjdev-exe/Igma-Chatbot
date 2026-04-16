import "dotenv/config";
import path from "node:path";
import process from "node:process";
import { promises as fs } from "node:fs";
import mammoth from "mammoth";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

/**
 * Production-friendly ingestion script for chatbot_chunks.
 * Flow: read files -> normalize text -> chunk -> embed -> upsert to Supabase.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const DOCS_DIR = process.env.DOCS_DIR || path.resolve(process.cwd(), "docs");
const EMBEDDING_MODEL = "gemini-embedding-001";
const CHUNK_SIZE = Number(process.env.CHUNK_SIZE || 1200);
const CHUNK_OVERLAP = Number(process.env.CHUNK_OVERLAP || 180);
const MAX_RETRIES = 3;
const UPSERT_BATCH_SIZE = 15;

if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing env vars. Required: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeText = (text) =>
  text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const slice = text.slice(start, end).trim();
    if (slice) chunks.push(slice);
    if (end >= text.length) break;
    start = Math.max(0, end - overlap);
  }

  return chunks;
}

async function listSupportedFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await listSupportedFiles(fullPath);
      files.push(...nested);
      continue;
    }

    if (/\.(txt|md|docx)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

async function extractText(filePath) {
  if (filePath.toLowerCase().endsWith(".docx")) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || "";
  }
  return fs.readFile(filePath, "utf8");
}

async function embedText(text, retries = MAX_RETRIES) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const result = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
      });
      const vector = result.embeddings?.[0]?.values;
      if (!vector) throw new Error("Embedding API returned no vector values.");
      return vector;
    } catch (error) {
      lastError = error;
      const status = error?.status;
      const message = String(error?.message || "").toLowerCase();
      const retriable =
        status === 429 ||
        status >= 500 ||
        message.includes("resource_exhausted") ||
        message.includes("failed to fetch") ||
        message.includes("connection");

      if (!retriable || attempt === retries) break;
      const delayMs = attempt * 1200;
      console.warn(`Embedding retry ${attempt}/${retries} in ${delayMs}ms...`);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

async function upsertChunks(docName, chunks) {
  const rows = [];

  for (let i = 0; i < chunks.length; i += 1) {
    const content = chunks[i];
    const embedding = await embedText(content);
    rows.push({
      doc_name: docName,
      chunk_index: i,
      content,
      embedding,
    });
  }

  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await supabase.from("chatbot_chunks").upsert(batch, {
      onConflict: "doc_name,chunk_index",
    });
    if (error) throw error;
  }

  // Remove stale chunks when a file now has fewer chunks than before.
  const { error: cleanupError } = await supabase
    .from("chatbot_chunks")
    .delete()
    .eq("doc_name", docName)
    .gte("chunk_index", chunks.length);
  if (cleanupError) throw cleanupError;
}

async function processFile(filePath) {
  const docName = path.basename(filePath);
  const rawText = await extractText(filePath);
  const normalized = normalizeText(rawText);

  if (!normalized) {
    console.warn(`Skipping empty file: ${docName}`);
    return { docName, chunkCount: 0, skipped: true };
  }

  const chunks = chunkText(normalized);
  if (!chunks.length) {
    console.warn(`Skipping file with no usable chunks: ${docName}`);
    return { docName, chunkCount: 0, skipped: true };
  }

  await upsertChunks(docName, chunks);
  return { docName, chunkCount: chunks.length, skipped: false };
}

async function main() {
  try {
    await fs.access(DOCS_DIR);
    const files = await listSupportedFiles(DOCS_DIR);
    if (!files.length) {
      console.log(`No supported files found in: ${DOCS_DIR}`);
      return;
    }

    console.log(`Found ${files.length} file(s) in ${DOCS_DIR}`);
    let processed = 0;
    let skipped = 0;
    let totalChunks = 0;

    for (const filePath of files) {
      const rel = path.relative(process.cwd(), filePath);
      console.log(`\nProcessing: ${rel}`);

      try {
        const result = await processFile(filePath);
        if (result.skipped) {
          skipped += 1;
        } else {
          processed += 1;
          totalChunks += result.chunkCount;
        }
        console.log(
          `Done: ${result.docName} (${result.chunkCount} chunk${result.chunkCount === 1 ? "" : "s"})`
        );
      } catch (error) {
        console.error(`Failed: ${rel}`, error);
      }
    }

    console.log("\nIngestion complete.");
    console.log(`Processed files: ${processed}`);
    console.log(`Skipped files: ${skipped}`);
    console.log(`Total chunks upserted: ${totalChunks}`);
  } catch (error) {
    console.error("Script failed:", error);
    process.exitCode = 1;
  }
}

main();
