import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import chatRoutes from "./routes/chatRoutes.js";
import chatHistoryRoutes from "./routes/chatHistoryRoutes.js";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/chat", chatRoutes);
app.use("/api/chats", chatHistoryRoutes);

app.get("/", (req, res) => res.send("HealthBay backend is running!"));

export default app;
