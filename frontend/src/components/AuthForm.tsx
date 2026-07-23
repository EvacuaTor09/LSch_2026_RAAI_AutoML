import { useState } from 'react';
import type { FormEvent } from 'react';

type AuthFormProps = {
  title: string;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (username: string, password: string) => Promise<void>;
  footer: React.ReactNode;
};

export function AuthForm({ title, submitLabel, pendingLabel, onSubmit, footer }: AuthFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await onSubmit(username, password);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Что-то пошло не так');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card panel" onSubmit={handleSubmit}>
        <p className="eyebrow">AutoML-оркестрация</p>
        <h1 className="auth-title">{title}</h1>

        <label className="text-field">
          Имя пользователя
          <input
            type="text"
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>

        <label className="text-field">
          Пароль
          <input
            type="password"
            required
            minLength={6}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="field-error">{error}</p>}

        <button type="submit" className="primary" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </button>

        <p className="auth-footer">{footer}</p>
      </form>
    </div>
  );
}
