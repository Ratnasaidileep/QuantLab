import React, { useEffect, useState } from 'react';
import {
  fetchCurrentUser,
  getStoredToken,
  logoutUser,
  setStoredToken,
} from '../api/client';
import type { UserDTO } from '../types';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserDTO | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const refreshUser = async () => {
    const token = getStoredToken();
    if (!token) {
      setCurrentUser(null);
      setIsLoadingUser(false);
      return;
    }

    try {
      const user = await fetchCurrentUser();
      setCurrentUser(user);
    } catch {
      logoutUser();
      setCurrentUser(null);
    } finally {
      setIsLoadingUser(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function initializeUserSession() {
      const token = getStoredToken();
      if (!token) {
        if (isMounted) setIsLoadingUser(false);
        return;
      }

      try {
        const user = await fetchCurrentUser();
        if (isMounted) setCurrentUser(user);
      } catch {
        logoutUser();
        if (isMounted) setCurrentUser(null);
      } finally {
        if (isMounted) setIsLoadingUser(false);
      }
    }

    initializeUserSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = (token: string, user: UserDTO) => {
    setStoredToken(token);
    setCurrentUser(user);
    setIsAuthModalOpen(false);
  };

  const setUser = (user: UserDTO) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
  };

  const logout = () => {
    logoutUser();
    setCurrentUser(null);
  };

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isLoadingUser,
        login,
        setUser,
        logout,
        refreshUser,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
