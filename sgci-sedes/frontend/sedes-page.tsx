'use client';
// ═══════════════════════════════════════════════════════════
// /admin/sedes — Gestión de Sedes del Grupo
// Solo visible y accesible para SUPERADMIN
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Plus, Edit2, Power, Users, UserCheck,
  MapPin, Phone, Mail, ChevronRight, X, Eye, EyeOff,
  Copy, Check, Search, UserPlus, Trash2, AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '../../../lib/auth-store';
import { apiClient } from '../../../lib/api';

// ─── Tipos ───────────────────────────────────────────────
interface Sede {
  id:             string;
  nombre:         string;
  domicilio:      string;
  telefono:       string | null;
  email:          string | null;
  logoUrl:        string | null;
  activa:         boolean;
  createdAt:      string;
  totalUsuarios:  number;
  totalPacientes: number;
  totalMedicos:   number;
}

interface MedicoDisponible {
  id: string;
  usuario: {
    nombre:          string;
    apellidoPaterno: string;
    apellidoMaterno: string | null;
    email:           string;
  };
  especialidades: { especialidad: { nombre: string } }[];
}

const EMPTY_FORM = {
  nombre: '', domicilio: '', telefono: '', emailSede: '',
  licenciaSanitaria: '', logoUrl: '',
  nombreAdmin: '', apellidoPaternoAdmin: '', apellidoMaternoAdmin: '', emailAdmin: '',
};

// ─── Componente principal ─────────────────────────────────
export default function SedesPage() {
  const { user } = useAuthStore();
  const [sedes, setSedes]               = useState<Sede[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  // Modales
  const [showCrear, setShowCrear]       = useState(false);
  const [showDetalle, setShowDetalle]   = useState<Sede | null>(null);
  const [showMedicos, setShowMedicos]   = useState<string | null>(null); // sedeId
  const [credenciales, setCredenciales] = useState<{ email: string; password: string } | null>(null);

  // Form crear
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [formError, setFormError]       = useState('');

  // Panel médicos
  const [medDisp, setMedDisp]           = useState<MedicoDisponible[]>([]);
  const [medSearch, setMedSearch]       = useState('');
  const [asignando, setAsignando]       = useState<string | null>(null);

  // Copy password
  const [copied, setCopied]             = useState(false);

  const cargarSedes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.get('/sedes');
      setSedes(data);
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar sedes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarSedes(); }, [cargarSedes]);

  // Verificar rol
  if (!user?.roles.includes('SUPERADMIN')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
          <p className="text-slate-600">Acceso restringido a Superadmin</p>
        </div>
      </div>
    );
  }

  // ─── Handlers ──────────────────────────────────────────
  const handleCrear = async () => {
    setSaving(true);
    setFormError('');
    try {
      const res = await apiClient.post('/sedes', {
        nombre:              form.nombre,
        domicilio:           form.domicilio,
        telefono:            form.telefono || undefined,
        emailSede:           form.emailSede || undefined,
        licenciaSanitaria:   form.licenciaSanitaria || undefined,
        logoUrl:             form.logoUrl || undefined,
        nombreAdmin:         form.nombreAdmin,
        apellidoPaternoAdmin: form.apellidoPaternoAdmin,
        apellidoMaternoAdmin: form.apellidoMaternoAdmin || undefined,
        emailAdmin:          form.emailAdmin,
      });
      setCredenciales(res.adminCredenciales);
      setForm(EMPTY_FORM);
      setShowCrear(false);
      await cargarSedes();
    } catch (e: any) {
      setFormError(e.message ?? 'Error al crear sede');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (sede: Sede) => {
    try {
      const res = await apiClient.patch(`/sedes/${sede.id}/toggle-activa`, {});
      setSedes((prev) =>
        prev.map((s) => s.id === sede.id ? { ...s, activa: res.activa } : s),
      );
    } catch (e: any) {
      alert(e.message ?? 'Error');
    }
  };

  const handleAbrirMedicos = async (sedeId: string) => {
    setShowMedicos(sedeId);
    setMedSearch('');
    try {
      const data = await apiClient.get(`/sedes/${sedeId}/medicos-disponibles`);
      setMedDisp(data);
    } catch { setMedDisp([]); }
  };

  const handleAsignar = async (sedeId: string, medicoId: string) => {
    setAsignando(medicoId);
    try {
      await apiClient.post(`/sedes/${sedeId}/medicos`, { medicoId });
      setMedDisp((prev) => prev.filter((m) => m.id !== medicoId));
      // Actualizar contador
      setSedes((prev) =>
        prev.map((s) =>
          s.id === sedeId ? { ...s, totalMedicos: s.totalMedicos + 1 } : s,
        ),
      );
    } catch (e: any) {
      alert(e.message ?? 'Error al asignar médico');
    } finally {
      setAsignando(null);
    }
  };

  const copiarPassword = async (pwd: string) => {
    await navigator.clipboard.writeText(pwd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const medicosFiltrados = medDisp.filter((m) => {
    const nombre = `${m.usuario.nombre} ${m.usuario.apellidoPaterno}`.toLowerCase();
    return nombre.includes(medSearch.toLowerCase());
  });

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            Gestión de Sedes
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {sedes.length} sede{sedes.length !== 1 ? 's' : ''} registrada{sedes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCrear(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva Sede
        </button>
      </div>

      {/* Error global */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Credenciales recién creadas — banner ONE-TIME */}
      {credenciales && (
        <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-400 rounded-xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-amber-800 text-sm mb-1">
                ⚠️ Credenciales del Admin — Guárdalas ahora, no se mostrarán de nuevo
              </p>
              <div className="mt-2 space-y-1 text-sm font-mono">
                <p><span className="text-slate-500">Email:</span> <span className="font-semibold text-slate-800">{credenciales.email}</span></p>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Password:</span>
                  <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border">
                    {credenciales.password}
                  </span>
                  <button
                    onClick={() => copiarPassword(credenciales.password)}
                    className="p-1 hover:bg-amber-100 rounded text-amber-700"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => setCredenciales(null)}
              className="text-amber-600 hover:text-amber-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Grid de sedes */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map((i) => (
            <div key={i} className="h-48 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sedes.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No hay sedes registradas</p>
          <p className="text-sm mt-1">Crea la primera sede del grupo</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sedes.map((sede) => (
            <div
              key={sede.id}
              className={`bg-white rounded-xl border-2 p-5 transition-all hover:shadow-md ${
                sede.activa ? 'border-slate-200' : 'border-slate-200 opacity-60'
              }`}
            >
              {/* Header tarjeta */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    sede.activa ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-800 truncate">{sede.nombre}</h3>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                      sede.activa
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {sede.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="space-y-1.5 mb-4 text-xs text-slate-500">
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{sede.domicilio}</span>
                </div>
                {sede.telefono && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>{sede.telefono}</span>
                  </div>
                )}
                {sede.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{sede.email}</span>
                  </div>
                )}
              </div>

              {/* Contadores */}
              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                {[
                  { label: 'Usuarios',  value: sede.totalUsuarios  },
                  { label: 'Pacientes', value: sede.totalPacientes },
                  { label: 'Médicos',   value: sede.totalMedicos   },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-lg py-1.5">
                    <p className="text-sm font-bold text-slate-800">{value}</p>
                    <p className="text-xs text-slate-400">{label}</p>
                  </div>
                ))}
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDetalle(sede)}
                  className="flex-1 flex items-center justify-center gap-1 text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50 py-1.5 rounded-lg border border-slate-200 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Editar
                </button>
                <button
                  onClick={() => handleAbrirMedicos(sede.id)}
                  className="flex-1 flex items-center justify-center gap-1 text-xs text-slate-600 hover:text-purple-600 hover:bg-purple-50 py-1.5 rounded-lg border border-slate-200 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Médicos
                </button>
                <button
                  onClick={() => handleToggle(sede)}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    sede.activa
                      ? 'text-red-500 hover:bg-red-50 border-slate-200'
                      : 'text-green-600 hover:bg-green-50 border-slate-200'
                  }`}
                  title={sede.activa ? 'Desactivar' : 'Activar'}
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Modal: Crear Sede ──────────────────────────── */}
      {showCrear && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                Nueva Sede
              </h2>
              <button onClick={() => { setShowCrear(false); setFormError(''); }}
                className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Datos de la sede */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Datos de la Sede
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Nombre *" col="sm:col-span-2">
                    <input
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                      placeholder="Ej: Clínica Norte"
                      className="input-base"
                    />
                  </FormField>
                  <FormField label="Domicilio completo *" col="sm:col-span-2">
                    <input
                      value={form.domicilio}
                      onChange={(e) => setForm({ ...form, domicilio: e.target.value })}
                      placeholder="Calle, número, colonia, ciudad"
                      className="input-base"
                    />
                  </FormField>
                  <FormField label="Teléfono">
                    <input
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                      placeholder="5512345678"
                      className="input-base"
                    />
                  </FormField>
                  <FormField label="Email de contacto">
                    <input
                      type="email"
                      value={form.emailSede}
                      onChange={(e) => setForm({ ...form, emailSede: e.target.value })}
                      placeholder="contacto@sede.mx"
                      className="input-base"
                    />
                  </FormField>
                  <FormField label="Licencia Sanitaria">
                    <input
                      value={form.licenciaSanitaria}
                      onChange={(e) => setForm({ ...form, licenciaSanitaria: e.target.value })}
                      placeholder="Número de licencia"
                      className="input-base"
                    />
                  </FormField>
                </div>
              </div>

              {/* Datos del admin */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Administrador de la Sede
                </p>
                <p className="text-xs text-slate-400 mb-3">
                  Se creará automáticamente. El password temporal se mostrará al guardar.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Nombre *">
                    <input
                      value={form.nombreAdmin}
                      onChange={(e) => setForm({ ...form, nombreAdmin: e.target.value })}
                      placeholder="Juan"
                      className="input-base"
                    />
                  </FormField>
                  <FormField label="Apellido Paterno *">
                    <input
                      value={form.apellidoPaternoAdmin}
                      onChange={(e) => setForm({ ...form, apellidoPaternoAdmin: e.target.value })}
                      placeholder="García"
                      className="input-base"
                    />
                  </FormField>
                  <FormField label="Apellido Materno">
                    <input
                      value={form.apellidoMaternoAdmin}
                      onChange={(e) => setForm({ ...form, apellidoMaternoAdmin: e.target.value })}
                      placeholder="López"
                      className="input-base"
                    />
                  </FormField>
                  <FormField label="Email del Admin *">
                    <input
                      type="email"
                      value={form.emailAdmin}
                      onChange={(e) => setForm({ ...form, emailAdmin: e.target.value })}
                      placeholder="admin@sede.mx"
                      className="input-base"
                    />
                  </FormField>
                </div>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => { setShowCrear(false); setFormError(''); }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrear}
                disabled={saving || !form.nombre || !form.domicilio || !form.nombreAdmin || !form.apellidoPaternoAdmin || !form.emailAdmin}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Crear Sede
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Asignar Médicos ─────────────────────── */}
      {showMedicos && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-purple-600" />
                Asignar Médicos
              </h2>
              <button onClick={() => setShowMedicos(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={medSearch}
                  onChange={(e) => setMedSearch(e.target.value)}
                  placeholder="Buscar médico..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {medicosFiltrados.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">
                  {medDisp.length === 0
                    ? 'Todos los médicos ya están asignados a esta sede'
                    : 'No hay resultados para la búsqueda'}
                </p>
              ) : (
                medicosFiltrados.map((med) => (
                  <div key={med.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        Dr. {med.usuario.nombre} {med.usuario.apellidoPaterno}
                        {med.usuario.apellidoMaterno ? ` ${med.usuario.apellidoMaterno}` : ''}
                      </p>
                      <p className="text-xs text-slate-500">
                        {med.especialidades.map((e) => e.especialidad.nombre).join(', ') || 'Sin especialidad'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAsignar(showMedicos, med.id)}
                      disabled={asignando === med.id}
                      className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {asignando === med.id
                        ? <span className="w-4 h-4 border-2 border-purple-300 border-t-purple-700 rounded-full animate-spin block" />
                        : <UserCheck className="w-4 h-4" />
                      }
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setShowMedicos(null)}
                className="w-full py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper component ─────────────────────────────────────
function FormField({
  label, children, col,
}: { label: string; children: React.ReactNode; col?: string }) {
  return (
    <div className={col}>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
