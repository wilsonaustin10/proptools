import { createContext, useContext, ReactNode, useState, useEffect } from 'react';

interface User {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  isVerified: boolean;
  isAdmin?: boolean;
}

interface UserContextType {
  user: User | null;
  login: (credentials: { username: string; password: string }) => Promise<{ ok: boolean; message?: string }>;
  register: (data: { username: string; password: string; firstName: string; lastName: string; email: string }) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<{ ok: boolean; message?: string }>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Fetch user on mount
  useEffect(() => {
    fetch('/api/user', { credentials: 'include' })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null));
  }, []);

  const login = async (credentials: { username: string; password: string }) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(credentials),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
      }
      return { ok: true, message: data.message };
    }

    const message = await res.text();
    return { ok: false, message };
  };

  const register = async (data: { username: string; password: string; firstName: string; lastName: string; email: string }) => {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
      }
      return { ok: true, message: data.message };
    }

    const message = await res.text();
    return { ok: false, message };
  };

  const logout = async () => {
    const res = await fetch('/api/logout', {
      method: 'POST',
      credentials: 'include',
    });

    if (res.ok) {
      setUser(null);
      const data = await res.json();
      return { ok: true, message: data.message };
    }

    const message = await res.text();
    return { ok: false, message };
  };

  return (
    <UserContext.Provider value={{ user, login, register, logout }}>
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