/**
 * Authentication Context
 * Manages user authentication state across the application
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Storage keys
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// Types
export type UserRole = 'admin' | 'editor' | 'viewer';
export type Team = 'data-science' | 'business-intelligence';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  team: Team | null;
  display_name: string | null;
  created_at: string;
  last_login: string | null;
  is_active: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
  hasPermission: (permission: Permission) => boolean;
}

// Permission types matching backend
export type Permission =
  | 'canExecuteSelect'
  | 'canExecuteInsert'
  | 'canExecuteUpdate'
  | 'canExecuteDelete'
  | 'canExecuteDDL'
  | 'canViewJobs'
  | 'canCreateJobs'
  | 'canEditJobs'
  | 'canDeleteJobs'
  | 'canRunJobs'
  | 'canViewFiles'
  | 'canUploadFiles'
  | 'canDeleteFiles'
  | 'canMoveFiles'
  | 'canCreateFolders'
  | 'canManageUsers'
  | 'canViewLogs';

// Permission matrix matching backend
const ROLE_PERMISSIONS: Record<UserRole, Record<Permission, boolean>> = {
  admin: {
    canExecuteSelect: true,
    canExecuteInsert: true,
    canExecuteUpdate: true,
    canExecuteDelete: true,
    canExecuteDDL: true,
    canViewJobs: true,
    canCreateJobs: true,
    canEditJobs: true,
    canDeleteJobs: true,
    canRunJobs: true,
    canViewFiles: true,
    canUploadFiles: true,
    canDeleteFiles: true,
    canMoveFiles: true,
    canCreateFolders: true,
    canManageUsers: true,
    canViewLogs: true,
  },
  editor: {
    canExecuteSelect: true,
    canExecuteInsert: true,
    canExecuteUpdate: false,
    canExecuteDelete: false,
    canExecuteDDL: false,
    canViewJobs: true,
    canCreateJobs: true,
    canEditJobs: true,
    canDeleteJobs: false,
    canRunJobs: true,
    canViewFiles: true,
    canUploadFiles: true,
    canDeleteFiles: false,
    canMoveFiles: true,
    canCreateFolders: true,
    canManageUsers: false,
    canViewLogs: false,
  },
  viewer: {
    canExecuteSelect: true,
    canExecuteInsert: false,
    canExecuteUpdate: false,
    canExecuteDelete: false,
    canExecuteDDL: false,
    canViewJobs: true,
    canCreateJobs: false,
    canEditJobs: false,
    canDeleteJobs: false,
    canRunJobs: false,
    canViewFiles: true,
    canUploadFiles: false,
    canDeleteFiles: false,
    canMoveFiles: false,
    canCreateFolders: false,
    canManageUsers: false,
    canViewLogs: false,
  },
};

// Create context
const AuthContext = createContext<AuthContextValue | null>(null);

// Helper function to get token for API calls
export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// Helper function to get auth headers
export function getAuthHeaders(): Headers {
  const token = getAuthToken();
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

// Helper function to create authenticated fetch
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
}

// Provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Initialize auth state from localStorage
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const userStr = localStorage.getItem(USER_KEY);
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        setState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
        
        // Validate token in background
        validateToken(token);
      } catch {
        // Invalid stored data, clear it
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } else {
      setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  }, []);

  // Validate token with backend
  const validateToken = async (token: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/validate`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        // Token is invalid, clear auth state
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch {
      // Network error, keep current state (offline support)
      console.warn('Could not validate token, continuing with cached auth state');
    }
  };

  // Login function
  const login = useCallback(async (username: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Login failed' }));
      throw new Error(error.message || 'Login failed');
    }

    const data = await response.json();
    
    if (!data.success || !data.data) {
      throw new Error('Invalid response from server');
    }

    const { token, user } = data.data;
    
    // Store in localStorage
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    
    // Update state
    setState({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    
    // Call logout endpoint (best effort)
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // Ignore logout API errors
      }
    }
    
    // Clear storage
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    
    // Update state
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    
    if (!token) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          localStorage.setItem(USER_KEY, JSON.stringify(data.data));
          setState(prev => ({
            ...prev,
            user: data.data,
          }));
        }
      }
    } catch {
      console.warn('Could not refresh user data');
    }
  }, []);

  // Change password
  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    const token = localStorage.getItem(TOKEN_KEY);
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to change password' }));
      throw new Error(error.message || 'Failed to change password');
    }
  }, []);

  // Check if user has role
  const hasRole = useCallback((...roles: UserRole[]) => {
    if (!state.user) return false;
    return roles.includes(state.user.role);
  }, [state.user]);

  // Check if user has permission
  const hasPermission = useCallback((permission: Permission) => {
    if (!state.user) return false;
    return ROLE_PERMISSIONS[state.user.role][permission];
  }, [state.user]);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    refreshUser,
    changePassword,
    hasRole,
    hasPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// HOC for protected routes
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: { roles?: UserRole[]; redirectTo?: string }
) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading, user } = useAuth();
    
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      );
    }
    
    if (!isAuthenticated) {
      // In a real app, you'd redirect to login
      // For now, we'll show a message
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground">Please log in to access this page.</p>
          </div>
        </div>
      );
    }
    
    if (options?.roles && user && !options.roles.includes(user.role)) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You do not have permission to access this page.</p>
          </div>
        </div>
      );
    }
    
    return <Component {...props} />;
  };
}
