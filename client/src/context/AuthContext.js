import React, { createContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService } from "../api/authApi";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(null); // null = loading
  const [user, setUser] = useState(null);

  // Load auth state from AsyncStorage on app start
  useEffect(() => {
    const loadAuth = async () => {
      try {
        const storedUser = await AsyncStorage.getItem("user");
        const storedAccessToken = await AsyncStorage.getItem("accessToken");

        if (storedUser && storedAccessToken) {
          setUser(JSON.parse(storedUser));
          setIsLoggedIn(true);
        } else {
          setUser(null);
          setIsLoggedIn(false);
        }
      } catch (e) {
        console.log("Failed to load auth state:", e);
        setUser(null);
        setIsLoggedIn(false);
      }
    };

    loadAuth();
  }, []);

  // Login wrapper
  const login = async (email, password) => {
    const data = await authService.login(email, password);
    if (data.user) {
      setUser(data.user);
      setIsLoggedIn(true);
    }
    return data;
  };

  // Signup wrapper
  const signup = async (firstName, lastName, email, password, birthday, gender) => {
    const birthDate = new Date(birthday);
    const today = new Date();

    // Compute age correctly even if birthday hasn't occurred yet this year
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    const name = `${firstName.trim()} ${lastName.trim()}`;
    const data = await authService.signup(name, email, password, age, gender);
    if (data.user) {
      setUser(data.user);
      setIsLoggedIn(true);
    }
    return data;
  };

  // Logout wrapper
  const logout = async () => {
    await authService.logout();
    setUser(null);
    setIsLoggedIn(false);
  };

  if (isLoggedIn === null) return null; // still loading

  return (
    <AuthContext.Provider
      value={{
        setIsLoggedIn,
        isLoggedIn,
        setUser,
        user,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
