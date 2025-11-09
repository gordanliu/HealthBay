// server/src/scripts/embedChunks.js
import dotenv from "dotenv";

// ✅ Load environment variables from project root
dotenv.config({ path: "../../.env" });

// Now dynamically import modules that depend on env vars
const { supabase } = await import("../config/db.js");
const { generateEmbedding } = await import("../services/geminiService.js");

/**
 * Split long text into smaller chunks (~500–700 words each)
 * Adjust for your use case; can also use tokens if needed.
 */
function chunkText(text, maxWords = 600) {
  const words = text.split(/\s+/);
  const chunks = [];

  for (let i = 0; i < words.length; i += maxWords) {
    const chunk = words.slice(i, i + maxWords).join(" ");
    chunks.push(chunk);
  }

  return chunks;
}

async function processDocuments() {
  try {
    console.log("🧩 Using Supabase URL:", process.env.SUPABASE_URL || "❌ Missing");
    console.log("🧩 Using GEMINI Key:", process.env.GEMINI_API_KEY ? "✅ Loaded" : "❌ Missing");

    console.log("🔍 Fetching all documents...");
    const { data: documents, error } = await supabase
      .from("documents")
      .select("id, body, title, source_url");

    if (error) throw error;
    if (!documents?.length) {
      console.log("❌ No documents found.");
      return;
    }

    console.log(`🧠 Found ${documents.length} documents to process.`);

    for (const doc of documents) {
      console.log(`📄 Processing document: ${doc.title || doc.id}`);

      const chunks = chunkText(doc.body);
      console.log(`✂️ Split into ${chunks.length} chunks.`);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await generateEmbedding(chunk);

        if (!embedding) {
          console.warn(`⚠️ Skipping empty or invalid chunk ${i}`);
          continue;
        }

        const { error: insertError } = await supabase.from("chunks").insert({
          document_id: doc.id,
          content: chunk,
          embedding,
          chunk_index: i,
          source_url: doc.source_url || null,
          title: doc.title || "Untitled Document",
        });

        if (insertError) {
          console.error(`❌ Error inserting chunk ${i}:`, insertError);
        } else {
          console.log(`✅ Inserted chunk ${i + 1}/${chunks.length}`);
        }
      }
    }

    console.log("🎉 All documents processed and chunked successfully!");
  } catch (err) {
    console.error("💥 Error during chunking and embedding:", err);
  }
}

processDocuments();
