import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { login as apiLogin, register as apiRegister } from '../api';
import { getToken, setToken } from '../api/client';
import type { AuthUser, LoginInput, RegisterInput } from '../types';

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Пользователя после логина/регистрации держим только в памяти (React
// state) — переживает только текущую вкладку. Токен — в localStorage, так
// что сама сессия (авторизованные запросы) переживает перезагрузку; при
// перезагрузке страницы просто разлогинит визуально (user снова null), но
// токен в API-запросах всё ещё будет уходить. Если нужно восстанавливать
// профиль после reload — добавить ручку /api/auth/me и дёрнуть её при
// старте (сейчас такой ручки в требованиях нет).
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user ?? getToken()),
      async login(input) {
        const result = await apiLogin(input);
        setToken(result.token);
        setUser(result.user);
      },
      async register(input) {
        const result = await apiRegister(input);
        setToken(result.token);
        setUser(result.user);
      },
      logout() {
        setToken(null);
        setUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth должен вызываться внутри <AuthProvider>');
  }
  return context;
}
