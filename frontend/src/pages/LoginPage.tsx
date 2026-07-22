import { Link, useNavigate } from 'react-router-dom';
import { AuthForm } from '../components/AuthForm';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  return (
    <AuthForm
      title="Вход"
      submitLabel="Войти"
      pendingLabel="Входим…"
      onSubmit={async (email, password) => {
        await login({ email, password });
        navigate('/', { replace: true });
      }}
      footer={
        <>
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </>
      }
    />
  );
}
