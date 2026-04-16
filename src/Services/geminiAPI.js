import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const CHAT_MODEL = "gemini-2.5-flash";
const EMBEDDING_MODEL = "gemini-embedding-001";
const MAX_RETRIES = 3;
const RETRIEVAL_THRESHOLD = 0.3;
const HIGH_CONFIDENCE_THRESHOLD = 0.55;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.4;
const MAX_CONTEXT_CHARS = 6000;
const MAX_HISTORY_CHARS = 1800;
const MATCH_COUNT = 5;
const BLENDED_TOP_WEIGHT = 0.7;
const BLENDED_AVERAGE_WEIGHT = 0.3;

// Detect transient connectivity issues worth retrying.
const isNetworkError = (error) =>
  error?.name === "TypeError" ||
  String(error?.message || "").toLowerCase().includes("failed to fetch") ||
  String(error?.message || "").toLowerCase().includes("connection closed");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Generic retry wrapper for network-sensitive API calls.
const withRetry = async (fn, label) => {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isNetworkError(error) || attempt === MAX_RETRIES) {
        throw error;
      }
      const delayMs = attempt * 700;
      console.warn(`${label} failed (attempt ${attempt}), retrying...`, error);
      await sleep(delayMs);
    }
  }
  throw lastError;
};

// Prevent overly long prompt sections from growing token usage too much.
const clampText = (text, maxChars) => {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
};

// Translate retrieval quality metrics into simple confidence levels.
const getConfidenceLevel = ({ blendedScore, hasRelevantData, chunkCount }) => {
  if (blendedScore >= HIGH_CONFIDENCE_THRESHOLD && chunkCount >= 2) {
    return "high";
  }
  if (blendedScore >= MEDIUM_CONFIDENCE_THRESHOLD) {
    return "medium";
  }
  if (hasRelevantData) {
    return "low";
  }
  return "none";
};

// Sets how strict the assistant should be based on retrieval confidence.
const getResponsePolicy = (confidenceLevel) => {
  if (confidenceLevel === "high") {
    return "Use the knowledge base context as your primary source of truth. Keep answers concise and practical.";
  }
  if (confidenceLevel === "medium") {
    return "Prefer the knowledge base context, but if details are incomplete, provide careful and clearly labeled general guidance.";
  }
  if (confidenceLevel === "low") {
    return "The context may be weakly related. Give a cautious answer and avoid making specific claims not clearly supported by context.";
  }
  return "No reliable knowledge base context was found. Give general guidance and suggest contacting the university for exact official details.";
};

// Builds the final prompt sent to Gemini chat generation.
const buildPrompt = ({ message, history, context, confidenceLevel }) => {
  const responsePolicy = getResponsePolicy(confidenceLevel);
  return `You are "Igma", a friendly assistant for the University of the East.
${responsePolicy}

Knowledge base context:
${context || "No relevant context found."}

Conversation history:
${clampText(history, MAX_HISTORY_CHARS) || "No prior messages."}

User question:
${message}`;
};

// Runs embedding + vector search and returns context with confidence metrics.
const getRetrievalResult = async (message) => {
  const embedResult = await withRetry(async () => {
    return ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: message,
    });
  });
  const queryEmbedding = embedResult.embeddings?.[0]?.values;
  if (!queryEmbedding) {
    throw new Error("No embedding values returned");
  }

  const { data: topChunks, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    match_threshold: RETRIEVAL_THRESHOLD,
    match_count: MATCH_COUNT,
  });
  if (error) {
    throw error;
  }

  const similarities = (topChunks || [])
    .map((chunk) => Number(chunk?.similarity ?? 0))
    .filter((value) => Number.isFinite(value));
  const topSimilarity = similarities[0] ?? 0;
  const avgSimilarity =
    similarities.length > 0
      ? similarities.reduce((sum, value) => sum + value, 0) / similarities.length
      : 0;
  const blendedScore =
    topSimilarity * BLENDED_TOP_WEIGHT + avgSimilarity * BLENDED_AVERAGE_WEIGHT;
  const hasRelevantData = (topChunks?.length ?? 0) > 0 && topSimilarity >= RETRIEVAL_THRESHOLD;
  const confidenceLevel = getConfidenceLevel({
    blendedScore,
    hasRelevantData,
    chunkCount: similarities.length,
  });
  const context = hasRelevantData
    ? clampText(topChunks.map((chunk) => chunk.content).join("\n\n"), MAX_CONTEXT_CHARS)
    : "";

  return {
    confidenceLevel,
    context,
    retrievalMetrics: {
      chunkCount: topChunks?.length ?? 0,
      topSimilarity,
      avgSimilarity,
      blendedScore,
    },
  };
};

// Main RAG pipeline used by the chat UI.
export const generateContent = async (message, history = "") => {
  try {
    if (!GEMINI_API_KEY) throw new Error("No Gemini API key found");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Supabase URL/anon key not configured");
    }

    let confidenceLevel = "none";
    let context = "";

    try {
      const retrievalResult = await getRetrievalResult(message);
      confidenceLevel = retrievalResult.confidenceLevel;
      context = retrievalResult.context;

      if (import.meta.env.DEV) {
        console.info("RAG retrieval summary:", {
          chunks: retrievalResult.retrievalMetrics.chunkCount,
          topSimilarity: Number(
            retrievalResult.retrievalMetrics.topSimilarity.toFixed(4)
          ),
          avgSimilarity: Number(
            retrievalResult.retrievalMetrics.avgSimilarity.toFixed(4)
          ),
          blendedScore: Number(
            retrievalResult.retrievalMetrics.blendedScore.toFixed(4)
          ),
          confidenceLevel: retrievalResult.confidenceLevel,
        });
      }
    } catch (ragError) {
      // If embedding/vector lookup fails, still continue chat without RAG context.
      console.warn("RAG lookup failed, continuing without context:", ragError);
    }

    const prompt = buildPrompt({ message, history, context, confidenceLevel });

    const genResult = await withRetry(async () => {
      return ai.models.generateContent({
        model: CHAT_MODEL,
        contents: prompt,
      });
    });

    return genResult.text;
  } catch (err) {
    console.error("Error generating content:", err);
    if (isNetworkError(err)) {
      return "I couldn't reach the AI service right now. Please check your internet or firewall settings and try again.";
    }
    return "Sorry, I couldn't find any information about that in the university data.";
  }
};