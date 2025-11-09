import express from 'express';
import {
  getChats,
  getChatMessages,
  createChat,
  updateChat,
  deleteChat,
} from '../controllers/chatHistoryController.js';

const router = express.Router();

router.get('/', getChats);
router.get('/:chatId/messages', getChatMessages);
router.post('/', createChat);
router.patch('/:chatId', updateChat);
router.delete('/:chatId', deleteChat);

export default router;

