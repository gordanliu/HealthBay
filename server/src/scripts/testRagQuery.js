// testRagQuery.js
import dotenv from "dotenv";
dotenv.config({ path: "../../.env" }); // load before anything else

const { supabase } = await import("../config/db.js");
const { embedder } = await import("../services/geminiService.js");

const question = "My knee hurts and I heard a pop while changing directions";

const run = async () => {
  try {
    console.log("🔑 Using Supabase URL:", process.env.SUPABASE_URL);
    console.log("🔑 Using GEMINI API Key:", process.env.GEMINI_API_KEY ? "Loaded ✅" : "❌ Missing");

    const embedding = (await embedder.embedContent(question)).embedding.values;

    const { data, error } = await supabase.rpc("match_chunks", {
      query_embedding: embedding,
      query_text: question,
      match_count: 10,
    });

    if (error) throw error;

    if (!data || data.length === 0) {
      console.log("⚠️ No matching chunks found.");
      return;
    }

    console.table(
      data.map((r) => ({
        title: r.title,
        similarity: r.similarity?.toFixed(3),
      }))
    );
  } catch (err) {
    console.error("❌ Error running RAG test:", err);
  }
};

run();
