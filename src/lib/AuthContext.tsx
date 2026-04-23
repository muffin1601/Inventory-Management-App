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
  const [user, setUser] = useState<UserAccessRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  // Initialize auth state on mount
  useEffect(() => {
    setIsClient(true);
    
    // Quick sync check for cached user to prevent flickering
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ims_user_cache_v1');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && (Date.now() - parsed._cachedAt < 3600000)) {
            setUser(parsed);
            setIsLoading(false); // Stop loading early if we have a cache
          }
        } catch (e) {}
      }
    }

    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const initAuth = async () => {
      try {
        // Set a timeout of 8 seconds - if auth check takes longer, proceed anyway
        const timeoutPromise = new Promise<null>((resolve) => {
          timeoutId = setTimeout(() => {
            console.warn('[AuthContext] Initial auth check timeout - proceeding with null user');
            resolve(null);
          }, 15000);
        });

        const authPromise = modulesService.getCurrentUser();
        const currentUser = await Promise.race([authPromise, timeoutPromise]);

        if (mounted) {
          setUser(currentUser || null);
        }
      } catch (error) {
        console.error('[AuthContext] Error initializing auth:', error);
        if (mounted) {
          setUser(null);
        }
      } finally {
        clearTimeout(timeoutId);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth state changes from Supabase
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (!mounted) return;

      console.log('[AuthContext] Auth state changed:', event);

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Only fetch fresh user if we're not already loading or if this is a real change
        if (isLoading) return; 

        try {
          const timeoutPromise = new Promise<null>((resolve) => {
            setTimeout(() => {
              console.warn(`[AuthContext] User fetch timeout after ${event} - using existing state`);
              resolve(null);
            }, 15000);
          });

          const authPromise = modulesService.getCurrentUser();
          const currentUser = await Promise.race([authPromise, timeoutPromise]);
          
          if (mounted && currentUser) {
            setUser(currentUser);
          }
        } catch (error) {
          console.error('[AuthContext] Error fetching user after auth change:', error);
        } finally {
          if (mounted) {
            setIsLoading(false);
          }
        }
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
