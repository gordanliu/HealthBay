// server/src/controllers/chatController.js
import { queryRAG } from "../services/ragService.js";

// export async function handleChat(req, res) {
//   try {
//     const { question } = req.body;
//     const answer = await queryRAG(question);
//     res.json({ answer });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to process query" });
//   }
// }

export async function handleChat(req, res) {
  const { message } = req.body;
  console.log("🗣️ Received:", message);
  res.json({ reply: `You said: ${message}` });
}
