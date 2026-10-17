import { createContext } from 'react';
import type { UserDTO } from '../types';

export interface AuthContextType {
  currentUser: UserDTO | null;
  isAuthenticated: boolean;
  isLoadingUser: boolean;
  login: (token: string, user: UserDTO) => void;
  setUser: (user: UserDTO) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
