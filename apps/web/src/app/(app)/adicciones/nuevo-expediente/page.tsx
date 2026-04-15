'use client';
// ═══════════════════════════════════════════════════════════
// NUEVO EXPEDIENTE ADICCIONES — /adicciones/nuevo-expediente
// NOM-028-SSA2 · Admisión · PTI inicial
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search, Heart, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import AppShell from '../../../../components/AppShell';
import { addictionsApi, patientsApi, adminApi } from '../../../../lib/api';

const SUSTANCIAS = [
  'Alcohol', 'Marihuana / Cannabis', 'Cocaína', 'Crack',
  'Metanfetamina / Cristal', 'Heroína', 'Opioides (prescripción)',
  'Benzodiacepinas', 'Inhalantes / Solventes', 'Tabaco / Nicotina',
  'Múltiples sustancias', 'Otra',
];

const MODALIDADES = [
  { value: 'AMBULATORIO',    label: 'Ambulatorio',    desc: 'Paciente vive en casa, asiste regularmente' },
  { value: 'HOSPITAL_DIA',   label: 'Hospital de día', desc: 'Asistencia intensiva de día' },
  { value: 'RESIDENCIAL',    label: 'Residencial',    desc: 'Internamiento 24 horas' },
  { value: 'GRUPAL',         label: 'Grupal',         desc: 'Principalmente sesiones grupales' },
];

export default function NuevoExpedienteAdiccionPage() {
  const router = useRouter();
  const [step, setStep] = useState<1|2|3>(1);
  const [selectedPaciente, setSelectedPaciente] = useState<any>(null);
  const [busqueda, setBusqueda] = useState('');
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: { modalidad: 'AMBULATORIO', sustanciasSecundarias: [] },
  });

  const { data: pacientes } = useQuery({
    queryKey: ['search-adx', busqueda],
    queryFn: async () => {
      const { data } = await patientsApi.search({ q: busqueda, limit: 6 });
      return data?.data?.filter((p: any) => !p.tieneExpedienteAdicciones);
    },
    enabled: busqueda.length >= 2,
  });

  const { data: medicos } = useQuery({
    queryKey: ['medicos'],
    queryFn: async () => { const { data } = await adminApi.getMedicos(); return data; },
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => addictionsApi.createExpediente({
      ...d,
      pacienteId: selectedPaciente?.id,
    }),
    onSuccess: () => router.push('/adicciones'),
  });

  const modalidad = watch('modalidad');

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/adicciones" className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Nuevo expediente de adicciones</h1>
            <p className="text-slate-500 text-sm">NOM-028-SSA2 · Admisión</p>
          </div>
        </div>

        {/* Pasos */}
        <div className="flex gap-2">
          {['Paciente', 'Sustancias', 'Tratamiento'].map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${step > i + 1 ? 'bg-emerald-500 text-white' : step === i + 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`text-xs ${step === i + 1 ? 'font-medium text-slate-900' : 'text-slate-400'}`}>{s}</span>
              {i < 2 && <div className="flex-1 h-px bg-slate-200" />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit(d => createMutation.mutate(d))}>

          {/* Paso 1 */}
          {step === 1 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <h2 className="font-semibold text-slate-900">Seleccionar paciente</h2>
              <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
                <Search size={13} className="text-slate-400 shrink-0" />
                <input type="text" placeholder="Buscar por nombre (sin expediente de adicciones previo)..."
                  value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  className="flex-1 text-sm outline-none" />
              </div>
              {pacientes?.map((p: any) => (
                <button key={p.id} type="button" onClick={() => setSelectedPaciente(p)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left ${selectedPaciente?.id === p.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <div className="w-8 h-8 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                    {p.nombre[0]}{p.apellidoPaterno[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{p.apellidoPaterno} {p.nombre}</p>
                    <p className="text-xs text-slate-500">{p.numeroExpediente}</p>
                  </div>
                </button>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Médico responsable *</label>
                <select {...register('medicoResponsableId', { required: true })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                  <option value="">Seleccionar médico...</option>
                  {medicos?.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      Dr(a). {m.usuario.nombre} {m.usuario.apellidoPaterno}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Motivo de consulta *</label>
                <textarea {...register('motivoConsulta', { required: true })} rows={3}
                  placeholder="Razón principal por la que el paciente busca tratamiento..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" />
              </div>
              <button type="button" onClick={() => setStep(2)}
                disabled={!selectedPaciente}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">
                Continuar →
              </button>
            </div>
          )}

          {/* Paso 2 */}
          {step === 2 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Perfil de consumo</h2>
                <button type="button" onClick={() => setStep(1)} className="text-xs text-blue-600">← Atrás</button>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Sustancia principal *</label>
                <select {...register('sustanciaPrincipal', { required: true })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                  <option value="">Seleccionar sustancia...</option>
                  {SUSTANCIAS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Edad de inicio del consumo</label>
                <input type="number" {...register('edadInicio', { valueAsNumber: true })} min={5} max={80}
                  placeholder="Años" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Patrón de consumo</label>
                <select {...register('patronConsumo')} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                  <option value="">Seleccionar...</option>
                  {['Experimental (ocasional)','Recreativo (fines de semana)','Habitual (varios días/semana)','Diario','Compulsivo (múltiples veces al día)'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Historia social</label>
                <textarea {...register('historiaSocial')} rows={3}
                  placeholder="Antecedentes familiares, situación laboral, relaciones, eventos relevantes..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Red de apoyo</label>
                <textarea {...register('redApoyo')} rows={2}
                  placeholder="Familia, amigos, grupos de apoyo disponibles..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" />
              </div>
              <button type="button" onClick={() => setStep(3)}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium">
                Continuar →
              </button>
            </div>
          )}

          {/* Paso 3 */}
          {step === 3 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Plan de tratamiento inicial</h2>
                <button type="button" onClick={() => setStep(2)} className="text-xs text-blue-600">← Atrás</button>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">Modalidad de tratamiento *</label>
                <div className="space-y-2">
                  {MODALIDADES.map(({ value, label, desc }) => (
                    <label key={value} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer ${modalidad === value ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                      <input type="radio" {...register('modalidad')} value={value} className="mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{label}</p>
                        <p className="text-xs text-slate-500">{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                <Heart size={12} className="inline mr-1" />
                El expediente se creará en estado <strong>EN_EVALUACIÓN</strong>. El Plan de Tratamiento Individual (PTI)
                completo se elabora después de aplicar los instrumentos de evaluación (AUDIT, DAST-10, etc.).
              </div>

              <button type="submit" disabled={createMutation.isPending}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {createMutation.isPending ? 'Creando expediente...' : <><CheckCircle size={16} /> Abrir expediente NOM-028</>}
              </button>
              {createMutation.isError && (
                <p className="text-red-600 text-sm text-center">
                  {(createMutation.error as any)?.response?.data?.message ?? 'Error al crear expediente'}
                </p>
              )}
            </div>
          )}
        </form>
      </div>
    </AppShell>
  );
}
