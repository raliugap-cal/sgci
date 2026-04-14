'use client';
// ═══════════════════════════════════════════════════════════
// LOGIN PAGE — /login
// Email + contraseña → MFA TOTP (si activado)
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

const mfaSchema = z.object({
  code: z.string().length(6, 'Código de 6 dígitos requerido'),
});

type LoginForm = z.infer<typeof loginSchema>;
type MfaForm = z.infer<typeof mfaSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { setSession, setMfaPending, mfaPending, mfaToken } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const mfaForm = useForm<MfaForm>({ resolver: zodResolver(mfaSchema) });

  const handleLogin = async (data: LoginForm) => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await authApi.login(data.email, data.password);
      if (res.mfaRequired) {
        setMfaPending(res.mfaToken);
      } else {
        setSession(res);
        router.push('/dashboard');
      }
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleMfa = async (data: MfaForm) => {
    if (!mfaToken) return;
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await authApi.verifyMfa(mfaToken, data.code);
      setSession(res);
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Código MFA inválido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">

        {/* Logo / Identidad */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">🏥</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">SGCI Clínica</h1>
          <p className="text-slate-500 text-sm mt-1">Sistema de Gestión Clínica Integral</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {!mfaPending ? (
          /* ─── Formulario de Login ─── */
          <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Correo electrónico</label>
              <input
                {...loginForm.register('email')}
                type="email"
                autoComplete="email"
                placeholder="medico@clinica.mx"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              {loginForm.formState.errors.email && (
                <p className="text-red-600 text-xs mt-1">{loginForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
              <input
                {...loginForm.register('password')}
                type="password"
                autoComplete="current-password"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              {loginForm.formState.errors.password && (
                <p className="text-red-600 text-xs mt-1">{loginForm.formState.errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </form>
        ) : (
          /* ─── Formulario MFA ─── */
          <form onSubmit={mfaForm.handleSubmit(handleMfa)} className="space-y-4">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">🔐</span>
              </div>
              <h2 className="font-semibold text-slate-900">Verificación en dos pasos</h2>
              <p className="text-slate-500 text-sm mt-1">Ingrese el código de su app de autenticación</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Código de 6 dígitos</label>
              <input
                {...mfaForm.register('code')}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                autoFocus
                className="w-full px-3 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest font-mono"
              />
              {mfaForm.formState.errors.code && (
                <p className="text-red-600 text-xs mt-1 text-center">{mfaForm.formState.errors.code.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Verificando...' : 'Verificar código'}
            </button>

            <button
              type="button"
              onClick={() => useAuthStore.getState().clearSession()}
              className="w-full py-2 text-slate-500 text-sm hover:text-slate-700"
            >
              Volver al login
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-400 mt-6">
          SGCI v2.1 · NOM-004 · NOM-028 · CFDI 4.0
        </p>
      </div>
    </div>
  );
}
