// server/src/scripts/embedSingleACL.js
import dotenv from "dotenv";
dotenv.config({ path: "../../.env" }); // ✅ Load env first

// Dynamic imports to ensure env vars are loaded before Supabase init
const { supabase } = await import("../config/db.js");
const { embedder } = await import("../services/geminiService.js");

// 🩺 Document metadata
const TITLE = "ACL Injury – Symptoms and Causes (Mayo Clinic)";
const SOURCE_URL =
  "https://www.mayoclinic.org/diseases-conditions/acl-injury/symptoms-causes/syc-20350738";

// Foreign keys
const INJURY_ID = "de81e778-bff2-45eb-9fda-9a530217de07"; // ACL Injury
const BODY_PART_ID = "75b9c1bc-f117-414e-b29b-74b3b484e843"; // Knee

// ✅ Document body text
const TEXT = `
An ACL injury is a tear or sprain of the anterior cruciate ligament (ACL) — one of the strong bands of tissue that help connect your thigh bone (femur) to your shinbone (tibia). ACL injuries most commonly occur during sports that involve sudden stops or changes in direction, jumping and landing — such as soccer, basketball, football and downhill skiing.

Many people hear a pop or feel a "popping" sensation in the knee when an ACL injury occurs. Your knee may swell, feel unstable and become too painful to bear weight.

Depending on the severity of your ACL injury, treatment may include rest and rehabilitation exercises to help you regain strength and stability, or surgery to replace the torn ligament followed by rehabilitation. A proper training program may help reduce the risk of an ACL injury.

---

### Symptoms
- Loud pop or “popping” sensation in the knee
- Severe pain and inability to continue activity
- Rapid swelling
- Loss of range of motion
- Instability or “giving way” when bearing weight

### Causes
ACL injuries often happen during:
- Sudden direction changes (cutting or pivoting)
- Landing awkwardly from a jump
- Stopping suddenly
- Receiving a direct blow to the knee (e.g., football tackle)

### Risk Factors
- Female sex (biomechanical and hormonal factors)
- Sports: soccer, football, basketball, skiing, gymnastics
- Poor conditioning or movement patterns
- Improper footwear or faulty equipment

### Complications
ACL injuries increase long-term risk of osteoarthritis, even after surgery.

### Prevention
Training to strengthen core and leg muscles, improve jumping/landing mechanics, and avoid knee valgus can reduce risk.
`;

async function run() {
  try {
    console.log("📘 Embedding single ACL source...");
    console.log("🔑 Using Supabase URL:", process.env.SUPABASE_URL);

    // 1️⃣ Check for existing document
    const { data: existingDocs, error: fetchError } = await supabase
      .from("documents")
      .select("id")
      .eq("title", TITLE)
      .limit(1);

    if (fetchError) throw fetchError;

    let docId;
    if (existingDocs && existingDocs.length > 0) {
      docId = existingDocs[0].id;
      console.log(`🗂️ Document already exists (id: ${docId}) — reusing.`);
    } else {
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .insert({
          title: TITLE,
          body: TEXT, // ✅ matches your schema
          source: SOURCE_URL,
          source_url: SOURCE_URL,
          injury_id: INJURY_ID,
          body_part_id: BODY_PART_ID,
        })
        .select()
        .single();

      if (docError) throw docError;
      docId = doc.id;
      console.log(`🗂️ Inserted into documents (id: ${docId})`);
    }

    // 2️⃣ Chunk & embed text
    const chunks = TEXT.split(/\n{2,}/).map((c) => c.trim()).filter(Boolean);
    console.log(`✂️ Created ${chunks.length} chunks`);

    let chunkIndex = 0;
    for (const chunk of chunks) {
      const embedding = (await embedder.embedContent(chunk)).embedding.values;

      const { error } = await supabase.from("chunks").insert({
        document_id: docId,
        title: TITLE,
        content: chunk,
        source_url: SOURCE_URL,
        chunk_index: chunkIndex++,
        embedding,
      });

      if (error) throw error;
    }

    console.log("✅ Successfully embedded ACL Mayo Clinic source!");
  } catch (err) {
    console.error("❌ Error inserting ACL document:", err);
  }
}

run();
