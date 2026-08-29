'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getAuthInfoFromBrowserCookie, removeAuthInfo } from '@/lib/auth';

interface UserContextType {
  isAdmin: boolean;
  setIsAdmin: (value: boolean) => void;
  hasCheckedIdentity: boolean;
  setHasCheckedIdentity: (value: boolean) => void;
  username: string | null;
  role: string | null;
  isLoggedIn: boolean;
  refreshUser: () => void;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasCheckedIdentity, setHasCheckedIdentity] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = () => {
    const authInfo = getAuthInfoFromBrowserCookie();
    const nextUsername = authInfo?.username || null;
    const nextRole = authInfo?.role || null;
    setUsername(nextUsername);
    setRole(nextRole);
    setIsLoggedIn(authInfo !== null);
    // localstorage 模式下 cookie 无 username，只要有 auth cookie 即视为已登录
    if (authInfo && authInfo.role) {
      setIsAdmin(true);
      setHasCheckedIdentity(true);
    } else {
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    refreshUser();
    window.addEventListener('moontv:user-changed', refreshUser);
    return () => window.removeEventListener('moontv:user-changed', refreshUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (err) {
      // 忽略网络错误，仍然清理本地状态
      console.error('logout failed:', err);
    }
    removeAuthInfo();
    refreshUser();
    window.dispatchEvent(new CustomEvent('moontv:user-changed'));
    if (pathname === '/admin') {
      router.replace('/');
    }
  };

  return (
    <UserContext.Provider
      value={{
        isAdmin,
        setIsAdmin,
        hasCheckedIdentity,
        setHasCheckedIdentity,
        username,
        role,
        isLoggedIn,
        refreshUser,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}