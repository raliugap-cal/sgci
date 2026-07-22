'use client';
// ═══════════════════════════════════════════════════════════
// PORTAL PACIENTE — LOGIN /login
// Email + contraseña temporal · Primer ingreso · PWA install
// ═══════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { portalApi } from '../../lib/sync';
import { loadPrefetch } from '../../lib/offline-store';
import { Stethoscope, Wifi, Lock } from 'lucide-react';

const schema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'Contraseña requerida'),
});

type LoginForm = z.infer<typeof schema>;

export default function PortalLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(schema),
  });

  // Capturar evento de instalación PWA
  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError(null);
    try {
      // Login del portal (endpoint separado del staff)
      const { data: res } = await portalApi.post('/auth/patient/login', data);

      // Guardar sesión en localStorage
      localStorage.setItem('portal_token', res.accessToken);
      localStorage.setItem('portal_paciente_id', res.pacienteId);
      localStorage.setItem('portal_nombre', res.nombre);
      localStorage.setItem('portal_sede_id', res.sedeId ?? '');
      if (res.expedienteAdiccionId) {
        localStorage.setItem('portal_expediente_adiccion_id', res.expedienteAdiccionId);
      }

      // Precarga inicial de datos offline
      try {
        const { data: prefetch } = await portalApi.get(`/sync/prefetch/${res.pacienteId}`);
        await loadPrefetch(prefetch);
      } catch {
        // Si falla la precarga, no bloquear el ingreso
      }

      router.push('/dashboard');
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-700 flex flex-col items-center justify-center p-4">

      {/* Invitación a instalar PWA */}
      {installPrompt && (
        <div className="w-full max-w-sm mb-4 bg-white/10 rounded-2xl p-4 text-white text-center">
          <p className="text-sm font-medium mb-2">📲 Instalar en tu teléfono</p>
          <p className="text-xs text-blue-200 mb-3">
            Accede sin internet a tus citas, recetas y diario
          </p>
          <button onClick={handleInstall}
            className="w-full py-2 bg-white text-blue-700 rounded-xl text-sm font-semibold hover:bg-blue-50">
            Instalar aplicación
          </button>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Stethoscope size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Mi Portal de Salud</h1>
          <p className="text-slate-500 text-sm mt-1">SGCI Clínica</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Correo electrónico</label>
            <input type="email" {...register('email')} autoComplete="email"
              placeholder="su@email.com"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
            <input type="password" {...register('password')} autoComplete="current-password"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        {/* Info offline */}
        <div className="mt-6 flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
          <Wifi size={12} className="shrink-0 mt-0.5 text-blue-500" />
          <p>
            Después del primer ingreso, podrá ver sus citas, recetas y diario
            <strong> sin necesidad de internet</strong>.
          </p>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4 flex items-center justify-center gap-1">
          <Lock size={10} /> Datos protegidos · LFPDPPP
        </p>
      </div>
    </div>
  );
}
