import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { login as apiLogin, me, register as apiRegister } from '../api';
import { getToken, setToken } from '../api/client';
import { DEV_USER, SKIP_AUTH } from '../config';
import type { AuthUser, LoginInput, RegisterInput } from '../types';

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  skipAuth: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(SKIP_AUTH ? DEV_USER : null);
  const [bootstrapping, setBootstrapping] = useState(!SKIP_AUTH);

  useEffect(() => {
    if (SKIP_AUTH) {
      return;
    }

    let active = true;

    async function bootstrap() {
      const token = getToken();
      if (!token) {
        if (active) {
          setBootstrapping(false);
        }
        return;
      }

      try {
        const profile = await me();
        if (active) {
          setUser(profile);
        }
      } catch {
        setToken(null);
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setBootstrapping(false);
        }
      }
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      skipAuth: SKIP_AUTH,
      isAuthenticated: SKIP_AUTH || Boolean(user ?? getToken()),
      async login(input) {
        const result = await apiLogin(input);
        setToken(result.token);
        setUser({ username: result.username });
      },
      async register(input) {
        const result = await apiRegister(input);
        setToken(result.token);
        setUser({ username: result.username });
      },
      logout() {
        if (SKIP_AUTH) {
          return;
        }
        setToken(null);
        setUser(null);
      },
    }),
    [user],
  );

  if (bootstrapping) {
    return (
      <div className="auth-shell">
        <div className="auth-card panel">
          <p className="muted">Проверяю сессию…</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth должен вызываться внутри <AuthProvider>');
  }
  return context;
}
