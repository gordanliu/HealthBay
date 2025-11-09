// client/src/api/apiClient.js
import axios from 'axios';

// Android emulator -> host machine localhost
const API_BASE_URL = 'https://nonfactually-twentypenny-elizbeth.ngrok-free.dev/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
