import React, { createContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedInState] = useState(null); // null = still loading
  const [user, setUserState] = useState(null); // store user info

  // Load login state and user info on startup
  useEffect(() => {
    const loadAuthData = async () => {
      try {
        const loginValue = await AsyncStorage.getItem('isLoggedIn');
        const userValue = await AsyncStorage.getItem('user');

        setIsLoggedInState(loginValue === 'true');
        setUserState(userValue ? JSON.parse(userValue) : null);
      } catch (e) {
        console.log('Error loading auth data', e);
        setIsLoggedInState(false);
        setUserState(null);
      }
    };
    loadAuthData();
  }, []);

  // Wrapper to update login state AND AsyncStorage
  const setIsLoggedIn = async (value) => {
    try {
      setIsLoggedInState(value);
      await AsyncStorage.setItem('isLoggedIn', value ? 'true' : 'false');
      if (!value) {
        // Clear user info on logout
        setUser(null);
      }
    } catch (e) {
      console.log('Error saving login state', e);
    }
  };

  // Wrapper to update user info AND AsyncStorage
  const setUser = async (userInfo) => {
    try {
      setUserState(userInfo);
      await AsyncStorage.setItem('user', JSON.stringify(userInfo));
    } catch (e) {
      console.log('Error saving user info', e);
    }
  };

  if (isLoggedIn === null) return null; // still loading

  return (
    <AuthContext.Provider value={{ isLoggedIn, setIsLoggedIn, user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
