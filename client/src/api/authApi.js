import api from "./apiClient";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const authService = {
  async signup(name, email, password, age, gender) {
    const res = await api.post("/auth/signup", {
      name,
      email,
      password,
      age,
      gender,
    });

    const data = res.data;

    if (data.accessToken && data.refreshToken) {
      await AsyncStorage.setItem("accessToken", data.accessToken);
      await AsyncStorage.setItem("refreshToken", data.refreshToken);
      await AsyncStorage.setItem("user", JSON.stringify(data.user));
    }

    return data;
  },

  // Login
  async login(email, password) {
    const res = await api.post("/auth/login", { email, password });
    const data = res.data;
    if (data.accessToken && data.refreshToken) {
      await AsyncStorage.setItem("accessToken", data.accessToken);
      await AsyncStorage.setItem("refreshToken", data.refreshToken);
      await AsyncStorage.setItem("user", JSON.stringify(data.user));
    }

    return data;
  },

  // Logout
  async logout() {
    try {
      await api.post("/auth/logout");
    } catch (e) {
      console.log("Logout failed:", e);
    } finally {
      await AsyncStorage.removeItem("accessToken");
      await AsyncStorage.removeItem("refreshToken");
      await AsyncStorage.removeItem("user");
    }
  },

  // Check authentication
  async isAuthenticated() {
    const user = await AsyncStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  },

  // Refresh access token
  async refreshAccessToken() {
    try {
      const refreshToken = await AsyncStorage.getItem("refreshToken");
      if (!refreshToken) return null;

      const data = await api.post("/auth/refresh", { refreshToken });
      if (data.accessToken) {
        await AsyncStorage.setItem("accessToken", data.accessToken);
      }
      return data.accessToken;
    } catch (error) {
      console.log("Refresh token failed:", error);
      await this.logout();
      return null;
    }
  },
};
