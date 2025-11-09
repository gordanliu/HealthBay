// client/src/api/apiClient.js
import axios from 'axios';

// For Android emulator, use 10.0.2.2 to reach host machine's localhost
// For iOS simulator or physical device on same network, use your local IP
const API_BASE_URL = 'http://10.0.2.2:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

export default api;
