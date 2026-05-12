import React from 'react';
import { Navigate } from "react-router-dom";
import { useAuth } from '@/hooks/use-auth';
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}