import express from 'express';
import cors from 'cors';
import testRagRoutes from './src/routes/testRag.js'; // ✅ correct relative path
import chatRoutes from './src/routes/chatRoutes.js'; // ✅ same for chat
import chatHistoryRoutes from './src/routes/chatHistoryRoutes.js'; // ✅ chat history routes

const app = express();

app.use(cors());
app.use(express.json());

// Debug middleware: log all incoming requests
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});

// Routes
app.use('/api', testRagRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/chats', chatHistoryRoutes);

// Health check (optional)
app.get('/', (req, res) => {
  res.send('✅ HealthBay backend running!');
});

// Server listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
