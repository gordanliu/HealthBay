import express from "express";
import cors from "cors";
import authRoutes from "./src/routes/authRoutes.js";  // ✅ correct relative path
import testRagRoutes from "./src/routes/testRag.js";  // ✅ correct relative path
import chatRoutes from "./src/routes/chatRoutes.js";   // ✅ same for chat
import userInjuryHistoryRoutes from "./src/routes/userInjuryHistoryRoutes.js"; // ✅ correct relative path

const app = express();

app.use(cors({
  origin: "*", // Adjust based on your client app's URL
  credentials: true,
}));
app.use(express.json());

// Routes
app.use("/api/injury-history", userInjuryHistoryRoutes);
app.use("/api", testRagRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);

// Health check (optional)
app.get("/", (req, res) => {
  res.send("✅ HealthBay backend running!");
});

// Server listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
