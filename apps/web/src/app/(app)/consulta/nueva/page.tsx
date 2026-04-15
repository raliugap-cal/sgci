'use client';
// ═══════════════════════════════════════════════════════════
// NUEVA CONSULTA — /consulta/nueva
// Inicia una consulta desde la ficha del paciente
// ═══════════════════════════════════════════════════════════
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowLeft, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import AppShell from '../../../components/AppShell';
import { appointmentsApi, hceApi, patientsApi } from '../../../lib/api';
import { useAuthStore } from '../../../lib/auth-store';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function NuevaConsultaPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const pacienteId = sp.get('pacienteId') ?? '';
  const citaIdParam = sp.get('citaId') ?? '';
  const [selectedCitaId, setSelectedCitaId] = useState(citaIdParam);

  const { data: paciente } = useQuery({
    queryKey: ['patient-basic', pacienteId],
    queryFn: async () => {
      const { data } = await patientsApi.findById(pacienteId);
      return data;
    },
    enabled: !!pacienteId,
  });

  const { data: citasHoy } = useQuery({
    queryKey: ['citas-hoy-medico', user?.medicoId],
    queryFn: async () => {
      const { data } = await appointmentsApi.findAll({
        fecha: format(new Date(), 'yyyy-MM-dd'),
        medicoId: user?.medicoId,
        pacienteId,
        limit: 10,
      });
      return data?.data ?? [];
    },
    enabled: !!user?.medicoId && !!pacienteId,
  });

  const openMutation = useMutation({
    mutationFn: (citaId: string) => hceApi.openConsulta(citaId),
    onSuccess: (res) => router.push(`/consulta/${res.data.id}`),
  });

  const citaSeleccionada = citasHoy?.find((c: any) => c.id === selectedCitaId);

  return (
    <AppShell>
      <div className="max-w-xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link href={`/pacientes/${pacienteId}`}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500">
            <ArrowLeft size={16} />
          </Link>
          <h1 className="text-xl font-bold text-slate-900">Iniciar consulta</h1>
        </div>

        {paciente && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-200 text-blue-800 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
              {paciente.nombre?.[0]}{paciente.apellidoPaterno?.[0]}
            </div>
            <div>
              <p className="font-semibold text-blue-900">
                {paciente.apellidoPaterno} {paciente.nombre}
              </p>
              <p className="text-xs text-blue-600">{paciente.numeroExpediente}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900 text-sm">Seleccionar cita del día</h2>

          {!citasHoy?.length ? (
            <p className="text-slate-400 text-sm text-center py-4">
              No hay citas activas para este paciente hoy
            </p>
          ) : (
            <div className="space-y-2">
              {citasHoy.map((cita: any) => (
                <button key={cita.id}
                  onClick={() => setSelectedCitaId(cita.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
                    selectedCitaId === cita.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}>
                  <Stethoscope size={16} className={selectedCitaId === cita.id ? 'text-blue-600' : 'text-slate-400'} />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {format(new Date(cita.fechaInicio), "HH:mm")} — {cita.tipoCita?.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-slate-500">Estado: {cita.estado}</p>
                  </div>
                  {cita.esTelemedicina && <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">🎥 Video</span>}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => openMutation.mutate(selectedCitaId)}
            disabled={!selectedCitaId || openMutation.isPending}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-40 hover:bg-blue-700 transition-colors">
            {openMutation.isPending ? 'Abriendo consulta...' : '→ Abrir consulta'}
          </button>

          {openMutation.isError && (
            <p className="text-red-600 text-sm text-center">
              {(openMutation.error as any)?.response?.data?.message ?? 'Error al abrir consulta'}
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
