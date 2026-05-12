import React, { useState, useEffect } from 'react';
import type { AuthUser } from '@shared/types';
import { AuthContext } from './AuthContext';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const stored = localStorage.getItem('harmony_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {
        localStorage.removeItem('harmony_user');
      }
    }
    setIsLoading(false);
  }, []);
  const login = (userData: AuthUser) => {
    setUser(userData);
    localStorage.setItem('harmony_user', JSON.stringify(userData));
  };
  const logout = () => {
    setUser(null);
    localStorage.removeItem('harmony_user');
  };
  const switchFamily = async (familyId: string) => {
    if (!user) return;
    try {
      const res = await api<AuthUser>('/api/family/switch', {
        method: 'POST',
        body: JSON.stringify({ familyId })
      });
      setUser(res);
      localStorage.setItem('harmony_user', JSON.stringify(res));
      toast.success(i18n.t('settings.switchSuccess'));
      setTimeout(() => {
        window.location.reload(); // Refresh to clear query caches for old family
      }, 800);
    } catch (err: any) {
      toast.error(err.message || i18n.t('settings.switchError'));
    }
  };
  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      switchFamily,
      isAuthenticated: !!user,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
}