export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
export interface AuthUser {
  id: string;
  name: string;
  activeFamilyId: string;
  familyIds: string[];
  token?: string;
}
export interface AuthContextType {
  user: AuthUser | null;
  login: (userData: AuthUser) => void;
  logout: () => void;
  switchFamily: (familyId: string) => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}
export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  activeFamilyId: string;
  familyIds: string[];
  preferences: {
    language: 'zh' | 'en';
    currency: string;
    reminders: {
      enabled: boolean;
      email: string;
      frequency: 'weekly' | 'monthly';
    };
  };
}
export interface Family {
  id: string;
  name: string;
  inviteCode: string;
  members: string[]; // User IDs
}
export interface FamilyMemberInfo {
  id: string;
  name: string;
  isOwner?: boolean;
}
export interface Contact {
  id: string;
  familyId: string;
  name: string;
  remarks?: string;
  updatedAt: number;
}
export interface Ledger {
  id: string;
  familyId: string;
  title: string;
  date: number;
  description?: string;
  totalGiven: number;
  totalReceived: number;
}
export type RenqingType = 'give' | 'receive';
export interface RenqingRecord {
  id: string;
  familyId: string;
  ledgerId?: string;
  contactId?: string;
  type: RenqingType;
  amount: number;
  personName: string;
  eventType: string;
  description?: string;
  timestamp: number;
}
export interface PaginatedResponse<T> {
  records: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
export interface Feedback {
  id: string;
  userId: string;
  familyId?: string;
  message: string;
  timestamp: number;
  status?: 'new' | 'reviewed';
}