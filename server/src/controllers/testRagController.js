// src/controllers/testRAGController.js
import { queryRAG } from "../services/ragService.js";

export async function testRAG(req, res) {
  try {
    const { question } = req.body;
    if (!question)
      return res.status(400).json({ success: false, error: "Missing 'question' in request body" });

    console.log("🧠 RAG Query:", question);
    const result = await queryRAG(question);

    res.json({
      success: true,
      query: question,
      ai_response: result.answer,
      retrieved_context: result.context,
      sources: result.sources,
      metadata: result.metadata
    });
  } catch (err) {
    console.error("❌ RAG Test Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
