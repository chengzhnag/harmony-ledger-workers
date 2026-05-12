import { createContext } from 'react';
import type { AuthContextType } from '@shared/types';
export const AuthContext = createContext<AuthContextType | undefined>(undefined);