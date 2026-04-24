'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { modulesService } from './services/modules';
import type { UserAccessRow } from '@/types/modules';
import { supabase } from './supabase';

type AuthContextType = {
  user: UserAccessRow | null;
  isLoading: boolean;
  isClient: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserAccessRow | null>(() => {
    // Initialize from cache synchronously to prevent flickering
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ims_user_cache_v1');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && (Date.now() - parsed._cachedAt < 3600000)) {
            return parsed;
          }
        } catch (e) {}
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [initDone, setInitDone] = useState(false);

  // Initialize auth state on mount ONLY
  useEffect(() => {
    setIsClient(true);
    setIsLoading(false); // Cache is already loaded from initializer
    
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const backgroundRefresh = async () => {
      try {
        const timeoutPromise = new Promise<null>((resolve) => {
          timeoutId = setTimeout(() => {
            resolve(null);
          }, 30000);
        });

        const authPromise = modulesService.getCurrentUser();
        const currentUser = await Promise.race([authPromise, timeoutPromise]);

        if (mounted && currentUser) {
          setUser(currentUser);
        }
      } catch (error) {
        console.error('[AuthContext] Background refresh error:', error);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    // Background refresh if cache exists
    if (user) {
      backgroundRefresh();
    }

    // Listen for auth state changes from Supabase
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (!mounted) return;

      console.log('[AuthContext] Auth state changed:', event);

      if (event === 'SIGNED_OUT') {
        setUser(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        backgroundRefresh();
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription?.unsubscribe();
    };
  }, []);

  const logout = async () => {
    try {
      await modulesService.logout();
      setUser(null);
    } catch (error) {
      console.error('Error during logout:', error);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isClient, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
