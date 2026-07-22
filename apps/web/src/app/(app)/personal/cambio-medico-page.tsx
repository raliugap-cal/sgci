'use client';
// ═══════════════════════════════════════════════════════════
// GESTIÓN DE PERSONAL — /personal
// Lista · Alta de usuarios · Alta de médicos · Activar/desactivar
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, UserPlus, Stethoscope, Search, ChevronRight,
  CheckCircle, XCircle, KeyRound, Shield,
} from 'lucide-react';
import AppShell from '../../../components/AppShell';
import { api } from '../../../lib/api';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../../../lib/auth-store';

// ── API helpers ────────────────────────────────────────────
const staffApi = {
  findAll:        (params: any) => api.get('/staff/usuarios', { params }),
  create:         (data: any)   => api.post('/staff/usuarios', data),
  toggle:         (id: string)  => api.post(`/staff/usuarios/${id}/toggle`),
  resetPassword:  (id: string, data: any) => api.post(`/staff/usuarios/${id}/reset-password`, data),
  createMedico:   (id: string, data: any) => api.post(`/staff/usuarios/${id}/medico`, data),
  getEspecialidades: () => api.get('/staff/especialidades'),
};

const ROL_LABELS: Record<string, string> = {
  SUPERADMIN:      'Super Admin',
  ADMIN_SEDE:      'Administrador',
  MEDICO:          'Médico',
  PSICOLOGO:       'Psicólogo',
  ENFERMERIA:      'Enfermería',
  TRABAJO_SOCIAL:  'Trabajo Social',
  RECEPCION:       'Recepción',
  LABORATORIO:     'Laboratorio',
  CAJA:            'Caja',
};

const ROL_COLOR: Record<string, string> = {
  SUPERADMIN:     'bg-red-100 text-red-700',
  ADMIN_SEDE:     'bg-purple-100 text-purple-700',
  MEDICO:         'bg-blue-100 text-blue-700',
  PSICOLOGO:      'bg-indigo-100 text-indigo-700',
  ENFERMERIA:     'bg-green-100 text-green-700',
  TRABAJO_SOCIAL: 'bg-teal-100 text-teal-700',
  RECEPCION:      'bg-amber-100 text-amber-700',
  LABORATORIO:    'bg-orange-100 text-orange-700',
  CAJA:           'bg-slate-100 text-slate-700',
};

// ── Formulario de nuevo usuario ────────────────────────────
function NuevoUsuarioModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<any>({
    defaultValues: { roles: ['RECEPCION'] },
  });
  const selectedRoles = watch('roles') as string[];
  const requiresMedico = selectedRoles.includes('MEDICO') || selectedRoles.includes('PSICOLOGO');

  const mutation = useMutation({
    mutationFn: (d: any) => staffApi.create(d),
    onSuccess: () => { onSuccess(); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-slate-900 mb-5">Nuevo usuario del personal</h2>

        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nombre *</label>
              <input {...(register as any)('nombre', { required: true })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Apellido paterno *</label>
              <input {...(register as any)('apellidoPaterno', { required: true })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Apellido materno</label>
              <input {...register('apellidoMaterno')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email *</label>
              <input type="email" {...(register as any)('email', { required: true })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Contraseña inicial *</label>
            <input type="password" {...(register as any)('password', { required: true, minLength: 8 })}
              placeholder="Mínimo 8 caracteres"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Roles *</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(ROL_LABELS).filter(([r]) => r !== 'SUPERADMIN').map(([rol, label]) => (
                <label key={rol} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" value={rol}
                    {...register('roles')}
                    className="rounded" />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {requiresMedico && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-800">📋 Datos del médico/psicólogo</p>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Cédula profesional *</label>
                <input {...register('cedulaProfesional')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Universidad</label>
                <input {...register('universidad')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" {...register('habilitadoControlados')} className="rounded" />
                <span>Habilitado para medicamentos controlados</span>
              </label>
            </div>
          )}

          {mutation.isError && (
            <p className="text-red-600 text-sm">
              {(mutation.error as any)?.response?.data?.message ?? 'Error al crear usuario'}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-700 text-sm font-medium">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {mutation.isPending ? 'Creando...' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────
export default function PersonalPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [rolFilter, setRolFilter] = useState('');
  const [showNuevo, setShowNuevo] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);
  const [newPass, setNewPass] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['staff', q, rolFilter],
    queryFn: async () => {
      const { data } = await staffApi.findAll({ q: q || undefined, rol: rolFilter || undefined, limit: 50 });
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => staffApi.toggle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, pass }: { id: string; pass: string }) =>
      staffApi.resetPassword(id, { nuevaPassword: pass }),
    onSuccess: () => { setResetId(null); setNewPass(''); },
  });

  const usuarios = data?.data ?? [];

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Users size={22} /> Gestión de Personal
            </h1>
            <p className="text-slate-500 text-sm mt-1">{data?.meta?.total ?? 0} usuarios registrados</p>
          </div>
          <button onClick={() => setShowNuevo(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
            <UserPlus size={15} /> Nuevo usuario
          </button>
        </div>

        {/* Filtros */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)}
              placeholder="Buscar por nombre o email..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <select value={rolFilter} onChange={e => setRolFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
            <option value="">Todos los roles</option>
            {Object.entries(ROL_LABELS).map(([r, l]) => (
              <option key={r} value={r}>{l}</option>
            ))}
          </select>
        </div>

        {/* Lista */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">Cargando...</div>
          ) : !usuarios.length ? (
            <div className="p-12 text-center">
              <Users size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-400">Sin usuarios registrados</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {usuarios.map((u: any) => (
                <div key={u.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                  {/* Avatar */}
                  <div className={clsx(
                    'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0',
                    u.activo ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'
                  )}>
                    {u.nombre?.[0]}{u.apellidoPaterno?.[0]}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 text-sm">
                        {u.apellidoPaterno} {u.apellidoMaterno}, {u.nombre}
                      </p>
                      {!u.activo && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                          Inactivo
                        </span>
                      )}
                      {u.medico && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Stethoscope size={10} /> Cédula: {u.medico.cedulaProfesional}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{u.email}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {u.roles?.map((r: string) => (
                        <span key={r} className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', ROL_COLOR[r] ?? 'bg-slate-100 text-slate-600')}>
                          {ROL_LABELS[r] ?? r}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setResetId(u.id)}
                      title="Resetear contraseña"
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                      <KeyRound size={14} />
                    </button>
                    <button
                      onClick={() => toggleMutation.mutate(u.id)}
                      disabled={toggleMutation.isPending}
                      title={u.activo ? 'Desactivar' : 'Activar'}
                      className={clsx(
                        'p-2 rounded-lg transition-colors',
                        u.activo
                          ? 'hover:bg-red-50 text-slate-400 hover:text-red-500'
                          : 'hover:bg-green-50 text-slate-400 hover:text-green-500'
                      )}>
                      {u.activo ? <XCircle size={14} /> : <CheckCircle size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal nuevo usuario */}
      {showNuevo && (
        <NuevoUsuarioModal
          onClose={() => setShowNuevo(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['staff'] })}
        />
      )}

      {/* Modal reset password */}
      {resetId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <KeyRound size={16} /> Resetear contraseña
            </h3>
            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
              placeholder="Nueva contraseña (mín. 8 caracteres)"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-4" />
            <div className="flex gap-3">
              <button onClick={() => { setResetId(null); setNewPass(''); }}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm">
                Cancelar
              </button>
              <button
                onClick={() => resetMutation.mutate({ id: resetId!, pass: newPass })}
                disabled={newPass.length < 8 || resetMutation.isPending}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                {resetMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
