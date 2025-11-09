// src/services/ragService.js
import { supabase } from "../config/db.js";
import { gemini, embedder } from "./geminiService.js";

// Embed user question text using Gemini
export async function embedText(text) {
  const result = await embedder.embedContent(text);
  return result.embedding.values;
}

// Main RAG pipeline
export async function queryRAG(question, { injuryId = null, bodyPartId = null } = {}) {
  try {
    // 1) Embed once
    const embedding = await embedText(question);

    // 2) Filtered retrieval first
    let { data: rows, error } = await supabase.rpc("match_chunks", {
      query_embedding: embedding,
      query_text: question,
      match_count: 10,
      injury_id_param: injuryId,
      body_part_id_param: bodyPartId,
    });
    if (error) throw error;

    // 3) Fallback to global search
    if (!rows || rows.length === 0) {
      console.warn("⚠️ No domain-specific matches — falling back to general RAG.");
      const { data: fallbackRows, error: fallbackErr } = await supabase.rpc("match_chunks", {
        query_embedding: embedding,
        query_text: question,
        match_count: 10,
      });
      if (fallbackErr) throw fallbackErr;
      rows = fallbackRows || [];
    }

    // 4) Coverage score
    const sims = rows.map(r => r.similarity || 0);
    const coverageScore = sims.length ? sims.reduce((a,b)=>a+b,0) / sims.length : 0;

    // 5) Re-rank with Gemini (best effort)
    let reranked = rows;
    try {
      const rerankPrompt = `
You are ranking rehabilitation-related text snippets for relevance.
Question: "${question}"

Retrieved snippets:
${rows.map((r, i) => `[${i + 1}] ${String(r.content || "").slice(0, 300)}`).join("\n\n")}

Return JSON array of the top 5 most relevant indices (1-based), e.g.: [2,1,5,3,4]`;
      const rerankRes = await gemini.generateContent(rerankPrompt);
      let top = [];
      try { top = JSON.parse(rerankRes.response.text().trim()); }
      catch { top = [1,2,3,4,5]; }
      reranked = top.map(i => rows[i - 1]).filter(Boolean).slice(0, 5);
    } catch (e) {
      console.warn("⚠️ Rerank failed, using default order:", e?.message || e);
    }

    // 6) Build context + sources
    const context = reranked.map((r, i) => `# Source ${i + 1}: ${r.title || "Document"}\n${r.content || ""}`).join("\n---\n");
    const sources = reranked.map((r, i) => ({ number: i + 1, title: r.title, source_url: r.source_url }));

    // 7) Decide “strong enough” (keep threshold, but **return coverageScore**)
    const sufficientCoverage = coverageScore > 0.5;

    // 8) Generate answer (used by other callers; not needed for diagnosis list, but harmless)
    const sourcesList = reranked.map((r, i) => `(${i + 1}) ${r.title || "Document"} — ${r.source_url || "No URL"}`).join("\n");
    const qaPrompt = sufficientCoverage
      ? `You are a medical rehabilitation assistant.
Use the provided context from trusted sources. Cite with [1],[2]. Include a disclaimer.

Context:
${context}

Sources:
${sourcesList}

Question:
${question}`
      : `You are a medical rehabilitation assistant.
No closely matching clinical documents. Provide a general, evidence-informed answer (state it's AI-generated). 

Question:
${question}`;

    const qaRes = await gemini.generateContent(qaPrompt);
    const answer = qaRes.response.text();

    return {
      answer,
      ragUsed: sufficientCoverage,
      provenance: sufficientCoverage
        ? "Based on verified clinical sources from HealthBay’s database."
        : "AI-generated summary (no direct source match).",
      coverageScore,
      context,
      sources,
      metadata: {
        model: "gemini-2.0-flash-exp",
        chunks_used: reranked.length,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (err) {
    console.error("❌ RAG Query Error:", err);
    // Let callers gracefully degrade
    return {
      answer: null,
      ragUsed: false,
      provenance: "AI-generated summary (RAG unavailable).",
      coverageScore: 0,
      context: "",
      sources: [],
      metadata: { error: err?.message || String(err) },
    };
  }
}
