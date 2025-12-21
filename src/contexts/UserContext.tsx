'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

interface UserContextType {
  isAdmin: boolean;
  setIsAdmin: (value: boolean) => void;
  hasCheckedIdentity: boolean;
  setHasCheckedIdentity: (value: boolean) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasCheckedIdentity, setHasCheckedIdentity] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check if user is already logged in as admin via cookie
    const authInfo = getAuthInfoFromBrowserCookie();
    if (authInfo?.username) {
      setIsAdmin(true);
      setHasCheckedIdentity(true);
    }
  }, []);

  return (
    <UserContext.Provider value={{ isAdmin, setIsAdmin, hasCheckedIdentity, setHasCheckedIdentity }}>
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
