// client/src/api/apiClient.js
import axios from "axios";

// Local dev server (use your machine's IP so Expo can reach it)
load_dotnev();
const API_BASE_URL = env.API_BASE_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
