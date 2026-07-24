'use client';
// ═══════════════════════════════════════════════════════════
// LOGIN PAGE — /login
// JWT + MFA TOTP
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '@/lib/auth-store';
import { authApi } from '@/lib/api';
import { Eye, EyeOff, Shield } from 'lucide-react';

interface LoginForm { email: string; password: string; }
interface MfaForm   { code: string; }

export default function LoginPage() {
  const { setSession, setMfaPending, mfaPending, mfaToken } = useAuthStore();
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();
  const { register: regMfa, handleSubmit: handleMfaSubmit, formState: { errors: mfaErrors } } = useForm<MfaForm>();

  const handleLogin = async (data: LoginForm) => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await authApi.login(data.email, data.password);
      if (res.mfaRequired) {
        setMfaPending(res.mfaToken);
      } else {
        setSession(res);
        // Usar window.location para garantizar que localStorage se persista antes de navegar
        window.location.href = '/dashboard';
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
      window.location.href = '/dashboard';
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Código MFA inválido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logotipo.jpeg" alt="SGCI" className="h-16 w-16 rounded-2xl object-cover mx-auto mb-4 shadow-lg" />
          <h1 className="text-2xl font-bold text-white">SGCI</h1>
          <p className="text-blue-300 text-sm mt-1">Sistema de Gestión Clínica Integral</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {!mfaPending ? (
            <>
              <h2 className="text-lg font-bold text-slate-800 mb-6">Iniciar sesión</h2>
              <form onSubmit={handleSubmit(handleLogin)} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Correo electrónico</label>
                  <input
                    type="email"
                    {...register('email', { required: 'Requerido' })}
                    placeholder="usuario@clinica.mx"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-0.5">{errors.email.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Contraseña</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      {...register('password', { required: 'Requerido', minLength: { value: 8, message: 'Mínimo 8 caracteres' } })}
                      placeholder="••••••••"
                      className="w-full px-3 py-2.5 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-500 text-xs mt-0.5">{errors.password.message}</p>}
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {loading ? 'Verificando...' : 'Entrar'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-6">
                <Shield size={20} className="text-blue-600" />
                <h2 className="text-lg font-bold text-slate-800">Verificación MFA</h2>
              </div>
              <p className="text-sm text-slate-500 mb-4">Ingresa el código de 6 dígitos de tu aplicación autenticadora.</p>
              <form onSubmit={handleMfaSubmit(handleMfa)} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Código MFA</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    {...regMfa('code', { required: 'Requerido', minLength: { value: 6, message: '6 dígitos' } })}
                    placeholder="000000"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  {mfaErrors.code && <p className="text-red-500 text-xs mt-0.5">{mfaErrors.code.message}</p>}
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Verificar
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-blue-400 text-xs mt-6">
          © {new Date().getFullYear()} SGCI — Admon360Corp
        </p>
      </div>
    </div>
  );
}
