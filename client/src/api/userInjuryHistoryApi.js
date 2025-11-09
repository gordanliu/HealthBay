import api from "./apiClient";

export const userInjuryHistoryApi = {
  async getUserInjuryHistory(userId) {
    try {
      const response = await api.get(`/injury-history/${userId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching user injury history:", error);
      throw error;
    }
  },

}