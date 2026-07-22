'use client';
// ═══════════════════════════════════════════════════════════
// /admin/sedes — Gestión de Sedes del Grupo
// Solo visible y accesible para SUPERADMIN
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Plus, Edit2, Power, UserCheck,
  MapPin, Phone, Mail, X,
  Copy, Check, Search, UserPlus, AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { api } from '@/lib/api';

// ─── Tipos ────────────────────────────────────────────────
interface Sede {
  id:             string;
  nombre:         string;
  razonSocial:    string;
  rfc:            string;
  direccionFiscal: Record<string, any>;
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
  nombre: '', razonSocial: '', rfc: '',
  calle: '', numero: '', colonia: '', ciudad: '', cp: '',
  telefono: '', emailSede: '', licenciaSanitaria: '', logoUrl: '',
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
  const [showMedicos, setShowMedicos]   = useState<string | null>(null);
  const [credenciales, setCredenciales] = useState<{ email: string; password: string } | null>(null);

  // Form
  const [form, setForm]     = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Panel médicos
  const [medDisp, setMedDisp]     = useState<MedicoDisponible[]>([]);
  const [medSearch, setMedSearch] = useState('');
  const [asignando, setAsignando] = useState<string | null>(null);

  // Copy password
  const [copied, setCopied] = useState(false);

  // ─── Cargar sedes ───────────────────────────────────────
  const cargarSedes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/sedes');
      setSedes(data);
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message ?? 'Error al cargar sedes');
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
      const { data } = await api.post('/sedes', {
        nombre:              form.nombre,
        razonSocial:         form.razonSocial,
        rfc:                 form.rfc,
        direccionFiscal: {
          calle:   form.calle,
          numero:  form.numero,
          colonia: form.colonia,
          ciudad:  form.ciudad,
          cp:      form.cp,
        },
        telefono:            form.telefono    || undefined,
        emailSede:           form.emailSede   || undefined,
        licenciaSanitaria:   form.licenciaSanitaria || undefined,
        logoUrl:             form.logoUrl     || undefined,
        nombreAdmin:         form.nombreAdmin,
        apellidoPaternoAdmin: form.apellidoPaternoAdmin,
        apellidoMaternoAdmin: form.apellidoMaternoAdmin || undefined,
        emailAdmin:          form.emailAdmin,
      });
      setCredenciales(data.adminCredenciales);
      setForm(EMPTY_FORM);
      setShowCrear(false);
      await cargarSedes();
    } catch (e: any) {
      setFormError(e.response?.data?.message ?? e.message ?? 'Error al crear sede');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (sede: Sede) => {
    try {
      const { data } = await api.patch(`/sedes/${sede.id}/toggle-activa`, {});
      setSedes((prev) =>
        prev.map((s) => s.id === sede.id ? { ...s, activa: data.activa } : s),
      );
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Error al cambiar estado');
    }
  };

  const handleAbrirMedicos = async (sedeId: string) => {
    setShowMedicos(sedeId);
    setMedSearch('');
    try {
      const { data } = await api.get(`/sedes/${sedeId}/medicos-disponibles`);
      setMedDisp(data);
    } catch { setMedDisp([]); }
  };

  const handleAsignar = async (sedeId: string, medicoId: string) => {
    setAsignando(medicoId);
    try {
      await api.post(`/sedes/${sedeId}/medicos`, { medicoId });
      setMedDisp((prev) => prev.filter((m) => m.id !== medicoId));
      setSedes((prev) =>
        prev.map((s) =>
          s.id === sedeId ? { ...s, totalMedicos: s.totalMedicos + 1 } : s,
        ),
      );
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Error al asignar médico');
    } finally {
      setAsignando(null);
    }
  };

  const copiarPassword = async (pwd: string) => {
    await navigator.clipboard.writeText(pwd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const f = (key: keyof typeof form, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const medicosFiltrados = medDisp.filter((m) =>
    `${m.usuario.nombre} ${m.usuario.apellidoPaterno}`
      .toLowerCase()
      .includes(medSearch.toLowerCase()),
  );

  const formValido =
    form.nombre && form.razonSocial && form.rfc &&
    form.calle && form.ciudad && form.cp &&
    form.nombreAdmin && form.apellidoPaternoAdmin && form.emailAdmin;

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
          onClick={() => { setShowCrear(true); setFormError(''); }}
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

      {/* Banner credenciales ONE-TIME */}
      {credenciales && (
        <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-400 rounded-xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-amber-800 text-sm mb-2">
                ⚠️ Credenciales del Admin — Guárdalas ahora, no se mostrarán de nuevo
              </p>
              <div className="space-y-1 text-sm font-mono">
                <p>
                  <span className="text-slate-500">Email: </span>
                  <span className="font-semibold text-slate-800">{credenciales.email}</span>
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Password: </span>
                  <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border">
                    {credenciales.password}
                  </span>
                  <button
                    onClick={() => copiarPassword(credenciales.password)}
                    className="p-1 hover:bg-amber-100 rounded text-amber-700"
                  >
                    {copied
                      ? <Check className="w-4 h-4 text-green-600" />
                      : <Copy className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>
            </div>
            <button onClick={() => setCredenciales(null)} className="text-amber-600 hover:text-amber-800">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Grid de sedes */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
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
              <div className="flex items-start gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  sede.activa ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-800 truncate">{sede.nombre}</h3>
                  <p className="text-xs text-slate-400 truncate">{sede.razonSocial}</p>
                  <span className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded-full mt-0.5 ${
                    sede.activa ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {sede.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="space-y-1.5 mb-4 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {sede.direccionFiscal?.ciudad ?? '—'}
                  </span>
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
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-slate-400">RFC:</span>
                  <span className="font-mono">{sede.rfc}</span>
                </div>
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
                  onClick={() => handleAbrirMedicos(sede.id)}
                  className="flex-1 flex items-center justify-center gap-1 text-xs text-slate-600 hover:text-purple-600 hover:bg-purple-50 py-1.5 rounded-lg border border-slate-200 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Médicos
                </button>
                <button
                  onClick={() => handleToggle(sede)}
                  className={`flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg border transition-colors ${
                    sede.activa
                      ? 'text-red-500 hover:bg-red-50 border-slate-200'
                      : 'text-green-600 hover:bg-green-50 border-slate-200'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  {sede.activa ? 'Desactivar' : 'Activar'}
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
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                Nueva Sede
              </h2>
              <button onClick={() => { setShowCrear(false); setFormError(''); }}
                className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">

              {/* Datos generales */}
              <section>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Datos de la Sede
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nombre *" col="sm:col-span-2">
                    <input value={form.nombre} onChange={(e) => f('nombre', e.target.value)}
                      placeholder="Clínica Norte" className="input-base" />
                  </Field>
                  <Field label="Razón Social *" col="sm:col-span-2">
                    <input value={form.razonSocial} onChange={(e) => f('razonSocial', e.target.value)}
                      placeholder="Grupo Médico Norte S.A. de C.V." className="input-base" />
                  </Field>
                  <Field label="RFC *">
                    <input value={form.rfc} onChange={(e) => f('rfc', e.target.value.toUpperCase())}
                      placeholder="GMN010101ABC" maxLength={13} className="input-base font-mono" />
                  </Field>
                  <Field label="Licencia Sanitaria">
                    <input value={form.licenciaSanitaria} onChange={(e) => f('licenciaSanitaria', e.target.value)}
                      placeholder="Número de licencia" className="input-base" />
                  </Field>
                  <Field label="Teléfono">
                    <input value={form.telefono} onChange={(e) => f('telefono', e.target.value)}
                      placeholder="5512345678" className="input-base" />
                  </Field>
                  <Field label="Email de contacto">
                    <input type="email" value={form.emailSede} onChange={(e) => f('emailSede', e.target.value)}
                      placeholder="contacto@sede.mx" className="input-base" />
                  </Field>
                </div>
              </section>

              {/* Dirección fiscal */}
              <section>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Dirección Fiscal
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Calle *" col="sm:col-span-2">
                    <input value={form.calle} onChange={(e) => f('calle', e.target.value)}
                      placeholder="Av. Insurgentes Sur" className="input-base" />
                  </Field>
                  <Field label="Número *">
                    <input value={form.numero} onChange={(e) => f('numero', e.target.value)}
                      placeholder="1234" className="input-base" />
                  </Field>
                  <Field label="Colonia">
                    <input value={form.colonia} onChange={(e) => f('colonia', e.target.value)}
                      placeholder="Del Valle" className="input-base" />
                  </Field>
                  <Field label="Ciudad *">
                    <input value={form.ciudad} onChange={(e) => f('ciudad', e.target.value)}
                      placeholder="Ciudad de México" className="input-base" />
                  </Field>
                  <Field label="Código Postal *">
                    <input value={form.cp} onChange={(e) => f('cp', e.target.value)}
                      placeholder="03100" maxLength={5} className="input-base" />
                  </Field>
                </div>
              </section>

              {/* Admin */}
              <section>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Administrador de la Sede
                </p>
                <p className="text-xs text-slate-400 mb-3">
                  Se creará automáticamente con rol Admin. El password temporal aparecerá al guardar.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nombre *">
                    <input value={form.nombreAdmin} onChange={(e) => f('nombreAdmin', e.target.value)}
                      placeholder="Juan" className="input-base" />
                  </Field>
                  <Field label="Apellido Paterno *">
                    <input value={form.apellidoPaternoAdmin} onChange={(e) => f('apellidoPaternoAdmin', e.target.value)}
                      placeholder="García" className="input-base" />
                  </Field>
                  <Field label="Apellido Materno">
                    <input value={form.apellidoMaternoAdmin} onChange={(e) => f('apellidoMaternoAdmin', e.target.value)}
                      placeholder="López" className="input-base" />
                  </Field>
                  <Field label="Email del Admin *">
                    <input type="email" value={form.emailAdmin} onChange={(e) => f('emailAdmin', e.target.value)}
                      placeholder="admin@sede.mx" className="input-base" />
                  </Field>
                </div>
              </section>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t bg-slate-50 rounded-b-2xl sticky bottom-0">
              <button
                onClick={() => { setShowCrear(false); setFormError(''); }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrear}
                disabled={saving || !formValido}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {saving && (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
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
                Asignar Médicos a Sede
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
                  placeholder="Buscar médico por nombre..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {medicosFiltrados.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">
                  {medDisp.length === 0
                    ? 'Todos los médicos ya están asignados a esta sede'
                    : 'Sin resultados para la búsqueda'}
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
                        {med.especialidades.map((e) => e.especialidad.nombre).join(', ') || 'Sin especialidad registrada'}
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

// ─── Helper ───────────────────────────────────────────────
function Field({ label, children, col }: {
  label: string; children: React.ReactNode; col?: string;
}) {
  return (
    <div className={col}>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
