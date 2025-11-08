import pool from "../config/db.js";
import { gemini, embedder } from "./geminiService.js";

export async function embedText(text) {
  const result = await embedder.embedContent(text);
  return result.embedding.values;
}

export async function queryRAG(question) {
  const embedding = await embedText(question);
  const { rows } = await pool.query(
    "SELECT content FROM chunks ORDER BY embedding <-> $1 LIMIT 5;",
    [embedding]
  );

  const context = rows.map((r) => r.content).join("\n---\n");

  const prompt = `
  You are a medical assistant specializing in rehabilitation.
  Use the following context to provide accurate and safe guidance.
  
  Context:
  ${context}

  Question:
  ${question}
  `;

  const response = await gemini.generateContent(prompt);
  return response.response.text();
}
