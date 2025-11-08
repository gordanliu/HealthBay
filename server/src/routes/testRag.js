import express from "express";
import { testRAG } from "../controllers/testRagController.js";
const router = express.Router();

router.post("/test-rag", testRAG);
   
export default router;
