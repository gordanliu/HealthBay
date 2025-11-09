import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Main Gemini model for generating answers
export const gemini = genAI.getGenerativeModel({
  model: "gemini-2.0-flash-exp",
});

// Embedding model for vectors
export const embedder = genAI.getGenerativeModel({
  model: "embedding-001",
});

/**
 * Generate a vector embedding for text using Gemini
 * @param {string} text - The text to embed
 * @returns {Promise<number[]>} - Float array representing the embedding
 */
export async function generateEmbedding(text) {
  if (!text || text.trim().length === 0) return null;

  try {
    const result = await embedder.embedContent(text);
    return result.embedding.values;
  } catch (err) {
    console.error("❌ Error generating embedding:", err);
    return null;
  }
}

/**
 * Embed and update a chunk in the database
 * @param {object} supabase - Supabase client
 * @param {string} chunkId - Chunk UUID
 * @param {string} content - Chunk text
 */
export async function embedAndStoreChunk(supabase, chunkId, content) {
  const embedding = await generateEmbedding(content);
  if (!embedding) {
    console.warn(`⚠️ Skipping chunk ${chunkId}, no embedding generated`);
    return;
  }

  const { error } = await supabase
    .from("chunks")
    .update({ embedding })
    .eq("id", chunkId);

  if (error) {
    console.error(`❌ Failed to update chunk ${chunkId}:`, error);
  } else {
    console.log(`✅ Embedded and stored chunk ${chunkId}`);
  }
}
