'use client';
// ═══════════════════════════════════════════════════════════
// ADMIN — /admin
// Configuración de sede · Integraciones · Folios · Servicios
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Settings, Link2, Pill, Package,
  CheckCircle, AlertCircle, Clock, Plus, Zap,
} from 'lucide-react';
import AppShell from '../../../components/AppShell';
import { adminApi } from '../../../lib/api';
import { clsx } from 'clsx';

function IntegrationCard({ label, status, detail, action }: {
  label: string; status: 'active' | 'standby' | 'missing'; detail: string; action?: React.ReactNode;
}) {
  const cfg = {
    active:  { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', badge: 'Activo' },
    standby: { icon: Clock,        color: 'text-amber-600',   bg: 'bg-amber-50',   badge: 'Standby' },
    missing: { icon: AlertCircle,  color: 'text-slate-400',   bg: 'bg-slate-50',   badge: 'No configurado' },
  }[status];
  const Icon = cfg.icon;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center', cfg.bg)}>
            <Icon size={16} className={cfg.color} />
          </div>
          <div>
            <p className="font-medium text-slate-900 text-sm">{label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{detail}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', cfg.bg, cfg.color)}>
            {cfg.badge}
          </span>
          {action}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'integrations' | 'folios' | 'services'>('overview');

  const { data: dashboard } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => { const { data } = await adminApi.getDashboard(); return data; },
  });

  const { data: integrations } = useQuery({
    queryKey: ['integrations'],
    queryFn: async () => { const { data } = await adminApi.getIntegrations(); return data; },
    enabled: activeTab === 'integrations',
  });

  const { data: medicos } = useQuery({
    queryKey: ['medicos'],
    queryFn: async () => { const { data } = await adminApi.getMedicos(); return data; },
    enabled: activeTab === 'folios',
  });

  const { data: servicios } = useQuery({
    queryKey: ['servicios'],
    queryFn: async () => { const { data } = await adminApi.getServices(); return data; },
    enabled: activeTab === 'services',
  });

  // Form de folios
  const [foliosForm, setFoliosForm] = useState<{ medicoId: string; folios: string }>({ medicoId: '', folios: '' });
  const addFoliosMutation = useMutation({
    mutationFn: () => adminApi.addFolios({
      medicoId: foliosForm.medicoId,
      folios: foliosForm.folios.split('\n').map(f => f.trim()).filter(Boolean),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['medicos'] }); setFoliosForm({ medicoId: '', folios: '' }); },
  });

  const tabs = [
    ['overview',      'Resumen',      Settings],
    ['integrations',  'Integraciones', Link2],
    ['folios',        'Folios COFEPRIS', Pill],
    ['services',      'Catálogo SAT',  Package],
  ] as const;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Administración</h1>
          <p className="text-slate-500 text-sm">Configuración de sede y sistema</p>
        </div>

        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit flex-wrap">
          {tabs.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && dashboard && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Citas hoy', value: dashboard.citasHoy, color: 'text-blue-600' },
                { label: 'Pacientes activos', value: dashboard.pacientesActivos, color: 'text-green-600' },
                { label: 'Médicos activos', value: dashboard.medicoActivos, color: 'text-purple-600' },
                { label: 'Facturas pendientes', value: dashboard.facturasPendientes, color: 'text-amber-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-xl border border-slate-200 p-5">
                  <p className={clsx('text-3xl font-bold', color)}>{value}</p>
                  <p className="text-sm text-slate-500 mt-1">{label}</p>
                </div>
              ))}
            </div>

            {dashboard.alertas?.foliosBajos?.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                  <AlertCircle size={14} /> Alerta: Folios COFEPRIS bajos
                </h3>
                {dashboard.alertas.foliosBajos.map((m: any) => (
                  <p key={m.medicoId} className="text-sm text-amber-700">
                    Dr(a). {m.nombre}: {m.foliosRestantes} folio{m.foliosRestantes !== 1 ? 's' : ''} restante{m.foliosRestantes !== 1 ? 's' : ''}
                  </p>
                ))}
                <button onClick={() => setActiveTab('folios')} className="mt-2 text-xs text-amber-800 underline">
                  Ir a gestión de folios →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Integrations */}
        {activeTab === 'integrations' && (
          <div className="space-y-3">
            <IntegrationCard
              label="Email — SendGrid"
              status={process.env.NEXT_PUBLIC_SENDGRID_KEY ? 'active' : 'standby'}
              detail="Canal primario de notificaciones en MVP"
            />
            <IntegrationCard
              label="SMS — AWS SNS"
              status="standby"
              detail="Canal secundario (fallback). Configurar AWS_SNS_ACCESS_KEY"
            />
            <IntegrationCard
              label="WhatsApp Business API (Meta)"
              status="standby"
              detail="Tramitación WABA en proceso. Activar con WHATSAPP_ENABLED=true"
              action={
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  En trámite
                </span>
              }
            />
            <IntegrationCard
              label="Telemedicina — Daily.co"
              status={integrations?.daily?.configured ? 'active' : 'missing'}
              detail={integrations?.daily?.configured ? 'Sala WebRTC lista' : 'Configurar DAILY_API_KEY'}
            />
            <IntegrationCard
              label="PAC — Timbrado CFDI 4.0"
              status={integrations?.pac?.configured ? 'active' : 'missing'}
              detail={integrations?.pac?.configured ? 'PAC conectado' : 'Configurar PAC_URL/USER/PASS'}
            />
            <IntegrationCard
              label="QuickBooks Online"
              status={integrations?.quickbooks?.enabled ? 'active' : 'standby'}
              detail={`Facturas pendientes de sync: ${integrations?.quickbooks?.syncPending ?? 0}`}
              action={
                !integrations?.quickbooks?.enabled ? (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    Activar QB_SYNC_ENABLED
                  </span>
                ) : undefined
              }
            />
          </div>
        )}

        {/* Folios COFEPRIS */}
        {activeTab === 'folios' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Los folios COFEPRIS son requeridos para recetas de estupefacientes. Cada folio es de un solo uso.
            </p>

            {/* Lista de médicos con sus folios */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wide grid grid-cols-3">
                <span>Médico</span>
                <span>Especialidad</span>
                <span>Folios disponibles</span>
              </div>
              {medicos?.map((m: any) => (
                <div key={m.id} className="grid grid-cols-3 px-4 py-3 border-b border-slate-50 text-sm items-center">
                  <span className="font-medium text-slate-900">
                    Dr(a). {m.usuario.nombre} {m.usuario.apellidoPaterno}
                  </span>
                  <span className="text-slate-500">
                    {m.especialidades?.find((e: any) => e.esPrincipal)?.especialidad?.nombre ?? '—'}
                  </span>
                  <span className={clsx(
                    'font-bold',
                    m.foliosCofepris?.length < 3 ? 'text-red-600' :
                    m.foliosCofepris?.length < 10 ? 'text-amber-600' : 'text-emerald-600',
                  )}>
                    {m.foliosCofepris?.length ?? 0}
                    {m.habilitadoControlados ? ' (habilitado)' : ''}
                  </span>
                </div>
              ))}
            </div>

            {/* Agregar folios */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <Plus size={14} /> Agregar folios COFEPRIS
              </h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Médico</label>
                <select value={foliosForm.medicoId} onChange={e => setFoliosForm(d => ({ ...d, medicoId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                  <option value="">Seleccionar médico...</option>
                  {medicos?.filter((m: any) => m.habilitadoControlados).map((m: any) => (
                    <option key={m.id} value={m.id}>
                      Dr(a). {m.usuario.nombre} {m.usuario.apellidoPaterno}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Números de folio (uno por línea)
                </label>
                <textarea
                  value={foliosForm.folios}
                  onChange={e => setFoliosForm(d => ({ ...d, folios: e.target.value }))}
                  rows={5}
                  placeholder="COFEPRIS-2024-001&#10;COFEPRIS-2024-002&#10;COFEPRIS-2024-003"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono resize-none"
                />
              </div>
              <button
                onClick={() => addFoliosMutation.mutate()}
                disabled={!foliosForm.medicoId || !foliosForm.folios.trim() || addFoliosMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
              >
                <Plus size={13} /> {addFoliosMutation.isPending ? 'Agregando...' : 'Agregar folios'}
              </button>
            </div>
          </div>
        )}

        {/* Catálogo de servicios SAT */}
        {activeTab === 'services' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 text-sm">Servicios del catálogo SAT</h2>
              <a href="/admin/servicios/nuevo"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                <Plus size={12} /> Nuevo servicio
              </a>
            </div>
            <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
              {servicios?.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{s.nombre}</p>
                    <p className="text-xs text-slate-500 font-mono">{s.claveSAT} · {s.claveUnidadSAT}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">
                      ${Number(s.precio).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                    {s.ivaAplicable && (
                      <p className="text-xs text-slate-400">IVA {(Number(s.tasaIva) * 100).toFixed(0)}%</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
