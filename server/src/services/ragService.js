// src/services/ragService.js
import { supabase } from "../config/db.js";
import { gemini, embedder } from "./geminiService.js";

// 🔹 Embed user question text using Gemini
export async function embedText(text) {
  const result = await embedder.embedContent(text);
  return result.embedding.values;
}

// 🔹 Main RAG pipeline
export async function queryRAG(question) {
  try {
    // 1️⃣ Embed the user's question
    const embedding = await embedText(question);

    // 2️⃣ Retrieve top 10 chunks from Supabase (hybrid vector + keyword)
    const { data: rows, error } = await supabase.rpc("match_chunks", {
      query_embedding: embedding,
      query_text: question,
      match_count: 10,
    });

    if (error) {
      console.error("❌ Supabase RPC error:", error);
      throw error;
    }

    if (!rows || rows.length === 0) {
      return {
        answer:
          "No relevant rehabilitation documents found in the database.",
        context: [],
        sources: [],
        metadata: { chunks_used: 0 },
      };
    }

    // 3️⃣ Re-rank retrieved chunks with Gemini to improve relevance
    let reranked = rows;
    try {
      console.log("🤖 Reranking retrieved chunks with Gemini...");

      const rerankPrompt = `
      You are ranking medical text snippets for relevance.
      Question: "${question}"

      Here are the retrieved text chunks:
      ${rows
        .map((r, i) => `[${i + 1}] ${r.content.slice(0, 400)}`)
        .join("\n\n")}

      Rank these chunks by how relevant they are to answering the question.
      Respond ONLY with a JSON array of the top 5 chunk indices (1-based).
      Example: [2, 5, 1, 3, 4]
      `;

      const rerankRes = await gemini.generateContent(rerankPrompt);
      const text = rerankRes.response.text().trim();

      let topIndices = [];
      try {
        topIndices = JSON.parse(text);
      } catch (e) {
        console.warn("⚠️ Failed to parse rerank response:", text);
        topIndices = [1, 2, 3, 4, 5]; // fallback to first 5
      }

      reranked = topIndices
        .map((i) => rows[i - 1])
        .filter(Boolean)
        .slice(0, 5);

      console.log(`✅ Reranked: kept ${reranked.length} top chunks`);
    } catch (rerankErr) {
      console.warn(
        "⚠️ Gemini reranking failed, using original order:",
        rerankErr
      );
    }

    // 4️⃣ Build sources list and context for Gemini
    const sourcesList = reranked
      .map(
        (r, i) =>
          `(${i + 1}) ${r.title || "Document"} — ${
            r.source_url || "No URL available"
          }`
      )
      .join("\n");

    const context = reranked
      .map(
        (r, i) =>
          `# Source ${i + 1}: ${r.title || "Document"}\n${r.content}`
      )
      .join("\n---\n");

    // 5️⃣ Compose final prompt for Gemini (with citations)
    const prompt = `
You are a medical assistant specializing in rehabilitation.
Use the following context from trusted clinical sources to provide accurate, safe, evidence-based guidance.

Each section includes a numbered source. 
When generating your answer, cite the relevant sources (like [1], [2]) after key statements.

Context:
${context}

Sources:
${sourcesList}

Question:
${question}

Instructions:
- Synthesize a clear, clinically accurate answer.
- Include brief citations using [number] style where appropriate.
- Conclude with a short reminder about consulting a healthcare professional.
`;

    // 6️⃣ Generate final answer using Gemini
    const response = await gemini.generateContent(prompt);
    const answer = response.response.text();

    // 7️⃣ Return structured response
    return {
      answer,
      context: reranked.map((r, i) => ({
        document_title: r.title,
        excerpt: r.content.slice(0, 250) + "...",
        source_url: r.source_url,
        source_number: i + 1,
      })),
      sources: reranked.map((r, i) => ({
        number: i + 1,
        title: r.title,
        source_url: r.source_url,
      })),
      metadata: {
        model: "gemini-2.0-flash-exp",
        chunks_used: reranked.length,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (err) {
    console.error("❌ RAG Query Error:", err);
    throw err;
  }
}
