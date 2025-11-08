import React, { createContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService } from "../api/authService";

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
  const signup = async (firstName, lastName, email, password, age, gender) => {
    const data = await authService.signup(firstName, lastName, email, password, age, gender);
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
