import { Link, useNavigate } from 'react-router-dom';
import { AuthForm } from '../components/AuthForm';
import { useAuth } from '../auth/AuthContext';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  return (
    <AuthForm
      title="Регистрация"
      submitLabel="Создать аккаунт"
      pendingLabel="Создаём аккаунт…"
      onSubmit={async (email, password) => {
        await register({ email, password });
        navigate('/', { replace: true });
      }}
      footer={
        <>
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </>
      }
    />
  );
}
