import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import chatRoutes from "./routes/chatRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userInjuryHistoryRoutes from "./routes/userInjuryHistoryRoutes.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/chat", chatRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/injury-history", userInjuryHistoryRoutes);
app.get("/", (req, res) => res.send("HealthBay backend is running!"));

export default app;
