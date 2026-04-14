'use client';
// ═══════════════════════════════════════════════════════════
// CONSULTA ACTIVA — /consulta/[id]
// Nota SOAP · Signos vitales · Diagnósticos · Receta
// Firma digital · Cierre de consulta
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  FileText, Heart, Stethoscope, Pill, CheckCircle,
  Save, PenLine, AlertTriangle, ChevronDown, ChevronRight,
  FlaskConical, Lock,
} from 'lucide-react';
import AppShell from '../../../../components/AppShell';
import { hceApi, labApi, prescriptionsApi } from '../../../../lib/api';
import { clsx } from 'clsx';

type SoapForm = {
  subjetivo: string;
  objetivo: string;
  evaluacion: string;
  plan: string;
};

type VitalsForm = {
  pesoKg?: number;
  tallaCm?: number;
  taSistolica?: number;
  taDiastolica?: number;
  fcLpm?: number;
  frRpm?: number;
  temperaturaC?: number;
  spo2Pct?: number;
  dolorEscala?: number;
  notas?: string;
};

function Section({ title, icon: Icon, children, defaultOpen = true }: any) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
          <Icon size={14} className="text-slate-400" />
          {title}
        </span>
        {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

export default function ConsultaActivaPage() {
  const { id: consultaId } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'soap' | 'vitals' | 'diagnoses' | 'lab' | 'rx'>('soap');
  const [cie10Search, setCie10Search] = useState('');
  const [notaId, setNotaId] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  const [saving, setSaving] = useState(false);

  const soapForm = useForm<SoapForm>();
  const vitalsForm = useForm<VitalsForm>();

  // Búsqueda CIE-10
  const { data: cie10Results } = useQuery({
    queryKey: ['cie10', cie10Search],
    queryFn: async () => {
      if (cie10Search.length < 2) return [];
      const { data } = await hceApi.searchCie10(cie10Search);
      return data;
    },
    enabled: cie10Search.length >= 2,
  });

  // Guardar nota SOAP
  const saveNota = useMutation({
    mutationFn: async (data: SoapForm) => {
      if (notaId) {
        return hceApi.updateNota(notaId, data);
      } else {
        const res = await hceApi.createNota({ consultaId, tipoNota: 'SOAP', ...data });
        setNotaId(res.data.id);
        return res;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consulta', consultaId] }),
  });

  // Firmar nota
  const signNota = useMutation({
    mutationFn: () => hceApi.signNota(notaId!),
    onSuccess: () => setSigned(true),
  });

  // Guardar vitales
  const saveVitals = useMutation({
    mutationFn: (data: VitalsForm) => hceApi.upsertVitals({ consultaId, ...data }),
  });

  // Cerrar consulta
  const closeConsulta = useMutation({
    mutationFn: () => hceApi.closeConsulta(consultaId),
    onSuccess: () => router.back(),
  });

  const tabs = [
    { id: 'soap',      label: 'Nota SOAP',     icon: FileText },
    { id: 'vitals',    label: 'Signos vitales', icon: Heart },
    { id: 'diagnoses', label: 'Diagnósticos',   icon: Stethoscope },
    { id: 'lab',       label: 'Laboratorio',    icon: FlaskConical },
    { id: 'rx',        label: 'Receta',         icon: Pill },
  ] as const;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-4">

        {/* Header consulta */}
        <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-4">
          <div>
            <h1 className="font-bold text-slate-900">Consulta activa</h1>
            <p className="text-sm text-slate-500">ID: {consultaId?.substring(0, 8)}</p>
          </div>
          <div className="flex gap-2">
            {!signed ? (
              <>
                <button
                  onClick={() => soapForm.handleSubmit(d => saveNota.mutate(d))()}
                  disabled={saveNota.isPending}
                  className="flex items-center gap-2 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50"
                >
                  <Save size={13} /> Guardar borrador
                </button>
                {notaId && (
                  <button
                    onClick={() => signNota.mutate()}
                    disabled={signNota.isPending}
                    className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
                  >
                    <PenLine size={13} /> Firmar nota
                  </button>
                )}
              </>
            ) : (
              <span className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                <CheckCircle size={14} /> Nota firmada
              </span>
            )}
            <button
              onClick={() => closeConsulta.mutate()}
              disabled={!signed || closeConsulta.isPending}
              className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Lock size={13} /> Cerrar consulta
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium flex-1 justify-center transition-colors',
                activeTab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* SOAP Note */}
        {activeTab === 'soap' && (
          <div className="space-y-3">
            {signed && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-sm text-emerald-700">
                <Lock size={13} /> Esta nota está firmada y no puede modificarse
              </div>
            )}
            {['subjetivo', 'objetivo', 'evaluacion', 'plan'].map((field) => {
              const labels: Record<string, { label: string; placeholder: string }> = {
                subjetivo:  { label: 'S — Subjetivo', placeholder: 'Motivo de consulta, síntomas referidos por el paciente...' },
                objetivo:   { label: 'O — Objetivo', placeholder: 'Exploración física, hallazgos clínicos, signos vitales...' },
                evaluacion: { label: 'A — Evaluación (Assessment)', placeholder: 'Diagnóstico de trabajo, impresión diagnóstica...' },
                plan:       { label: 'P — Plan', placeholder: 'Tratamiento, estudios, interconsultas, seguimiento...' },
              };
              const { label, placeholder } = labels[field];
              return (
                <div key={field} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                    <span className="text-sm font-semibold text-slate-700">{label}</span>
                  </div>
                  <textarea
                    {...soapForm.register(field as keyof SoapForm)}
                    disabled={signed}
                    placeholder={placeholder}
                    rows={4}
                    className="w-full px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none resize-none disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Signos Vitales */}
        {activeTab === 'vitals' && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Signos vitales</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { name: 'pesoKg',       label: 'Peso', unit: 'kg',  step: '0.1', min: '1', max: '300' },
                { name: 'tallaCm',      label: 'Talla', unit: 'cm', step: '1',   min: '50', max: '250' },
                { name: 'taSistolica',  label: 'TA Sistólica', unit: 'mmHg', step: '1', min: '50', max: '250' },
                { name: 'taDiastolica', label: 'TA Diastólica', unit: 'mmHg', step: '1', min: '30', max: '150' },
                { name: 'fcLpm',        label: 'Frecuencia cardíaca', unit: 'lpm', step: '1', min: '30', max: '250' },
                { name: 'frRpm',        label: 'Frec. respiratoria', unit: 'rpm', step: '1', min: '5', max: '60' },
                { name: 'temperaturaC', label: 'Temperatura', unit: '°C', step: '0.1', min: '30', max: '43' },
                { name: 'spo2Pct',      label: 'SpO₂', unit: '%', step: '1', min: '0', max: '100' },
                { name: 'dolorEscala',  label: 'Dolor (EVA)', unit: '/10', step: '1', min: '0', max: '10' },
              ].map(({ name, label, unit, step, min, max }) => (
                <div key={name}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                    <input
                      type="number"
                      step={step}
                      min={min}
                      max={max}
                      {...vitalsForm.register(name as keyof VitalsForm, { valueAsNumber: true })}
                      className="flex-1 px-3 py-2 text-sm outline-none"
                      placeholder="–"
                    />
                    <span className="px-2 text-xs text-slate-400 bg-slate-50 border-l border-slate-200 h-full flex items-center">
                      {unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
              <textarea
                {...vitalsForm.register('notas')}
                rows={2}
                placeholder="Observaciones adicionales..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none resize-none"
              />
            </div>
            <button
              onClick={() => vitalsForm.handleSubmit(d => saveVitals.mutate(d))()}
              disabled={saveVitals.isPending}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              <Save size={13} /> {saveVitals.isPending ? 'Guardando...' : 'Guardar signos vitales'}
            </button>
          </div>
        )}

        {/* Diagnósticos */}
        {activeTab === 'diagnoses' && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Diagnósticos CIE-10</h2>
            <div className="relative">
              <input
                type="text"
                value={cie10Search}
                onChange={(e) => setCie10Search(e.target.value)}
                placeholder="Buscar por código (F10) o descripción (alcohol)..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              {cie10Results && cie10Results.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {cie10Results.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={async () => {
                        await hceApi.addDiagnosis({ consultaId, cie10Id: c.id, tipo: 'principal', estado: 'activo' });
                        setCie10Search('');
                        qc.invalidateQueries({ queryKey: ['consulta', consultaId] });
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm border-b border-slate-50 last:border-0"
                    >
                      <span className="font-mono text-blue-600 text-xs">{c.codigo}</span>
                      <span className="ml-2 text-slate-700">{c.descripcion}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Escriba al menos 2 caracteres para buscar en el catálogo CIE-10
            </p>
          </div>
        )}

        {/* Laboratorio */}
        {activeTab === 'lab' && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Orden de laboratorio</h2>
            <p className="text-slate-500 text-sm">
              Para emitir una orden de laboratorio, acceda al módulo de{' '}
              <a href="/laboratorio/nueva-orden" className="text-blue-600 hover:underline">Laboratorio</a>{' '}
              con el ID de esta consulta.
            </p>
          </div>
        )}

        {/* Receta */}
        {activeTab === 'rx' && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Nueva receta</h2>
            <p className="text-slate-500 text-sm">
              Para emitir una receta, acceda al módulo de{' '}
              <a href="/recetas/nueva" className="text-blue-600 hover:underline">Recetas</a>{' '}
              vinculando esta consulta.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
