"use client";

import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { authService, User, LoginCredentials, RegisterData, AuthResponse } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  loginWithGoogle: (credential: string) => Promise<AuthResponse>;
  register: (data: RegisterData) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCALE_SEGMENTS = new Set(['fr', 'en', 'es']);
const SESSION_AWARE_SEGMENTS = new Set([
  'admin',
  'catalogue',
  'choose-plan',
  'dashboard',
  'facturation',
  'flux',
  'ia',
  'markets',
  'notifications',
  'oauth',
  'onboarding',
  'optimiser',
  'parametres',
  'performance',
  'rapports',
  'scoring-canaux',
  'sources',
]);

function shouldBootstrapAuthSession(pathname: string | null): boolean {
  const segments = (pathname || '/').split('/').filter(Boolean);
  if (segments.length === 0) {
    return false;
  }

  const firstSegment = LOCALE_SEGMENTS.has(segments[0]) ? segments[1] : segments[0];
  return typeof firstSegment === 'string' && SESSION_AWARE_SEGMENTS.has(firstSegment);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sur 401, tenter un refresh puis retry (évite déconnexion à l'expiration du token)
  useEffect(() => {
    apiClient.setOn401(async () => {
      try {
        await authService.refreshToken();
        const currentUser = await authService.getCurrentUser(true);
        if (currentUser) setUser(currentUser);
        return true;
      } catch {
        return false;
      }
    });
  }, []);

  useEffect(() => {
    const cachedUser = authService.getCurrentUserSync();

    if (!shouldBootstrapAuthSession(pathname)) {
      setUser(cachedUser);
      setIsLoading(false);
      return;
    }

    const initAuth = async () => {
      setIsLoading(true);
      try {
        // Sur les zones protégées, on valide toujours la session côté backend
        // pour éviter les faux positifs dus au seul cache localStorage.
        const currentUser = await authService.getCurrentUser(true);
        setUser(currentUser);
      } catch (error) {
        console.error('Auth initialization failed:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [pathname]);

  const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      const response = await authService.login(credentials);
      setUser(response.user);
      return response;
    } catch (error) {
      setUser(null);
      throw error;
    }
  };

  const register = async (data: RegisterData): Promise<AuthResponse> => {
    try {
      const response = await authService.register(data);
      setUser(response.user);
      return response;
    } catch (error) {
      setUser(null);
      throw error;
    }
  };

  const loginWithGoogle = async (credential: string): Promise<AuthResponse> => {
    try {
      const response = await authService.loginWithGoogle(credential);
      setUser(response.user);
      return response;
    } catch (error) {
      setUser(null);
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      // La redirection est gérée dans authService.logout()
    }
  };

  const refreshToken = async (): Promise<void> => {
    try {
      await authService.refreshToken();
      const currentUser = await authService.getCurrentUser(true);
      setUser(currentUser);
    } catch (error) {
      setUser(null);
      throw error;
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const currentUser = await authService.getCurrentUser(true);
      setUser(currentUser);
    } catch {
      setUser(null);
    }
  };

  const hasRole = (role: string): boolean => {
    return authService.hasRole(role);
  };

  const hasPermission = (permission: string): boolean => {
    return authService.hasPermission(permission);
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    loginWithGoogle,
    register,
    logout,
    refreshToken,
    refreshUser,
    hasRole,
    hasPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for protecting routes
export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Redirect to login page — sauf dans l'app embarquée Shopify (auth par
      // session token, ne pas sortir de l'iframe vers le login SaaS).
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/embedded')) {
        window.location.href = '/login';
      }
    }
  }, [isAuthenticated, isLoading]);

  return { isAuthenticated, isLoading };
}

// Hook for role-based access
export function useRequireRole(role: string) {
  const { hasRole, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !hasRole(role)) {
      // Redirect to unauthorized page
      window.location.href = '/unauthorized';
    }
  }, [hasRole, isLoading, role]);

  return { hasRole: hasRole(role), isLoading };
}
