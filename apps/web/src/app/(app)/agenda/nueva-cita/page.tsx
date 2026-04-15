'use client';
// ═══════════════════════════════════════════════════════════
// NUEVA CITA — /agenda/nueva-cita
// Buscar paciente · Seleccionar médico · Elegir horario
// ═══════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Search, Calendar, Clock, User, Video, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import AppShell from '../../../../components/AppShell';
import { patientsApi, appointmentsApi, adminApi } from '../../../../lib/api';
import { clsx } from 'clsx';

const TIPO_CITA_OPTIONS = [
  { value: 'PRIMERA_VEZ',           label: 'Primera vez',           min: 45 },
  { value: 'SEGUIMIENTO',           label: 'Seguimiento',           min: 30 },
  { value: 'URGENCIA',              label: 'Urgencia',              min: 20 },
  { value: 'TELEMEDICINA',          label: 'Telemedicina 🎥',       min: 30 },
  { value: 'EVALUACION_ADICCIONES', label: 'Evaluación Adicciones', min: 90 },
  { value: 'SESION_GRUPAL',         label: 'Sesión Grupal',         min: 60 },
  { value: 'SESION_FAMILIAR',       label: 'Sesión Familiar',       min: 45 },
  { value: 'PROCEDIMIENTO',         label: 'Procedimiento',         min: 60 },
];

export default function NuevaCitaPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [paciente, setPaciente] = useState<any>(sp.get('pacienteId') ? { id: sp.get('pacienteId') } : null);
  const [medico, setMedico] = useState<any>(null);
  const [tipoCita, setTipoCita] = useState('SEGUIMIENTO');
  const [fecha, setFecha] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [slotSeleccionado, setSlotSeleccionado] = useState<any>(null);
  const [busqueda, setBusqueda] = useState('');
  const [motivo, setMotivo] = useState('');
  const [done, setDone] = useState(false);

  const { data: medicos } = useQuery({
    queryKey: ['medicos'],
    queryFn: async () => { const { data } = await adminApi.getMedicos(); return data; },
  });

  const { data: pacientes } = useQuery({
    queryKey: ['search-patients', busqueda],
    queryFn: async () => { const { data } = await patientsApi.search({ q: busqueda, limit: 8 }); return data?.data; },
    enabled: busqueda.length >= 2,
  });

  const { data: slots, isLoading: loadingSlots } = useQuery({
    queryKey: ['slots', medico?.id, fecha, tipoCita],
    queryFn: async () => {
      const { data } = await appointmentsApi.getAvailability({
        medicoId: medico.id, fecha, tipoCita,
        esTelemedicina: tipoCita === 'TELEMEDICINA',
      });
      return data?.slots ?? [];
    },
    enabled: !!medico?.id && !!fecha,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await appointmentsApi.create({
        pacienteId: paciente.id,
        medicoId: medico.id,
        tipoCita,
        fechaInicio: slotSeleccionado.inicio,
        esTelemedicina: tipoCita === 'TELEMEDICINA',
        motivoConsulta: motivo,
      });
      return data;
    },
    onSuccess: () => setDone(true),
  });

  if (done) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto mt-20 text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">¡Cita agendada!</h2>
          <p className="text-slate-500">Se envió confirmación al paciente.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/agenda" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Ver agenda</Link>
            <button onClick={() => { setStep(1); setPaciente(null); setSlotSeleccionado(null); setDone(false); }}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm">
              Nueva cita
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  const steps = ['Paciente', 'Médico y tipo', 'Horario', 'Confirmar'];

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/agenda" className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500">
            <ArrowLeft size={16} />
          </Link>
          <h1 className="text-xl font-bold text-slate-900">Nueva cita</h1>
        </div>

        {/* Pasos */}
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={clsx(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                step > i + 1 ? 'bg-emerald-500 text-white' :
                step === i + 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500',
              )}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={clsx('text-xs', step === i + 1 ? 'font-medium text-slate-900' : 'text-slate-400')}>
                {s}
              </span>
              {i < steps.length - 1 && <div className="flex-1 h-px bg-slate-200" />}
            </div>
          ))}
        </div>

        {/* Paso 1: Seleccionar paciente */}
        {step === 1 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h2 className="font-semibold text-slate-900">¿Para qué paciente?</h2>
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Buscar por nombre o expediente..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="flex-1 text-sm outline-none"
              />
            </div>
            {pacientes?.map((p: any) => (
              <button key={p.id} onClick={() => { setPaciente(p); setStep(2); }}
                className={clsx(
                  'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                  paciente?.id === p.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50',
                )}
              >
                <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                  {p.nombre[0]}{p.apellidoPaterno[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {p.apellidoPaterno} {p.apellidoMaterno}, {p.nombre}
                  </p>
                  <p className="text-xs text-slate-500">{p.numeroExpediente}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Paso 2: Médico y tipo de cita */}
        {step === 2 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Médico y tipo de cita</h2>
              <button onClick={() => setStep(1)} className="text-xs text-blue-600">Cambiar paciente</button>
            </div>
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg text-sm">
              <User size={14} className="text-blue-600" />
              <span className="font-medium text-blue-800">
                {paciente?.apellidoPaterno} {paciente?.nombre}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Médico</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {medicos?.map((m: any) => (
                  <button key={m.id} onClick={() => setMedico(m)}
                    className={clsx(
                      'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                      medico?.id === m.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50',
                    )}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: m.colorAgenda + '20', color: m.colorAgenda }}>
                      {m.usuario.nombre[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        Dr(a). {m.usuario.nombre} {m.usuario.apellidoPaterno}
                      </p>
                      <p className="text-xs text-slate-500">
                        {m.especialidades?.find((e: any) => e.esPrincipal)?.especialidad?.nombre}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de cita</label>
              <div className="grid grid-cols-2 gap-2">
                {TIPO_CITA_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setTipoCita(opt.value)}
                    className={clsx(
                      'p-3 rounded-lg border text-sm text-left transition-colors',
                      tipoCita === opt.value ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-slate-200 hover:bg-slate-50 text-slate-700',
                    )}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{opt.min} min</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Motivo de consulta</label>
              <textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                rows={2}
                placeholder="Motivo principal de la consulta..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
              />
            </div>

            <button
              onClick={() => setStep(3)}
              disabled={!medico}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
            >
              Buscar horarios disponibles →
            </button>
          </div>
        )}

        {/* Paso 3: Horario */}
        {step === 3 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Seleccionar horario</h2>
              <button onClick={() => setStep(2)} className="text-xs text-blue-600">← Atrás</button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                min={format(new Date(), 'yyyy-MM-dd')}
                onChange={e => { setFecha(e.target.value); setSlotSeleccionado(null); }}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>

            {loadingSlots ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Buscando disponibilidad...
              </div>
            ) : !slots?.length ? (
              <div className="text-center py-6 text-slate-400 text-sm">
                No hay horarios disponibles en esta fecha.<br />
                Intente con otro día.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {slots.map((slot: any) => (
                  <button key={slot.inicio} onClick={() => setSlotSeleccionado(slot)}
                    className={clsx(
                      'py-2.5 rounded-lg border text-sm font-medium transition-colors',
                      slotSeleccionado?.inicio === slot.inicio
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700',
                    )}
                  >
                    {format(parseISO(slot.inicio), 'HH:mm')}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setStep(4)}
              disabled={!slotSeleccionado}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
            >
              Confirmar horario →
            </button>
          </div>
        )}

        {/* Paso 4: Confirmación */}
        {step === 4 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Confirmar cita</h2>
              <button onClick={() => setStep(3)} className="text-xs text-blue-600">← Atrás</button>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              {[
                { label: 'Paciente', value: `${paciente?.apellidoPaterno} ${paciente?.nombre}` },
                { label: 'Médico', value: `Dr(a). ${medico?.usuario?.nombre} ${medico?.usuario?.apellidoPaterno}` },
                { label: 'Tipo', value: TIPO_CITA_OPTIONS.find(o => o.value === tipoCita)?.label },
                { label: 'Fecha', value: format(parseISO(fecha), "EEEE d 'de' MMMM 'de' yyyy", { locale: es }) },
                { label: 'Hora', value: slotSeleccionado ? format(parseISO(slotSeleccionado.inicio), 'HH:mm') + ' hrs' : '' },
                { label: 'Motivo', value: motivo || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-2">
                  <span className="text-slate-500 w-20 shrink-0">{label}:</span>
                  <span className="font-medium text-slate-900">{value}</span>
                </div>
              ))}
              {tipoCita === 'TELEMEDICINA' && (
                <div className="flex items-center gap-2 pt-2 text-blue-600">
                  <Video size={13} />
                  <span className="text-xs">Se creará una sala de videoconsulta automáticamente</span>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Se enviará confirmación al paciente por email.
            </p>
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Agendando...' : '✓ Confirmar cita'}
            </button>
            {createMutation.isError && (
              <p className="text-red-600 text-sm text-center">
                {(createMutation.error as any)?.response?.data?.message ?? 'Error al agendar. Intente de nuevo.'}
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
