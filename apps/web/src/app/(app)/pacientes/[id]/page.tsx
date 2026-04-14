'use client';
// ═══════════════════════════════════════════════════════════
// EXPEDIENTE DEL PACIENTE — /pacientes/[id]
// Resumen clínico · Timeline · Citas · Facturas
// ═══════════════════════════════════════════════════════════
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { format, differenceInYears } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  User, Calendar, Pill, FlaskConical, Receipt,
  Heart, AlertTriangle, Phone, Mail, ArrowLeft,
  FileText, Shield, Plus, ExternalLink, CheckCircle,
} from 'lucide-react';
import AppShell from '../../../../components/AppShell';
import { patientsApi, appointmentsApi, billingApi } from '../../../../lib/api';
import { clsx } from 'clsx';

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-slate-500 shrink-0 w-28">{label}</span>
      <span className="text-slate-900 font-medium">{value}</span>
    </div>
  );
}

function Chip({ label, color = 'slate' }: { label: string; color?: string }) {
  const map: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-green-100 text-green-700',
  };
  return <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', map[color])}>{label}</span>;
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: summary, isLoading } = useQuery({
    queryKey: ['patient-summary', id],
    queryFn: async () => {
      const { data } = await patientsApi.clinicalSummary(id);
      return data;
    },
  });

  const { data: upcomingCitas } = useQuery({
    queryKey: ['patient-citas', id],
    queryFn: async () => {
      const { data } = await appointmentsApi.findAll({ pacienteId: id, limit: 5 });
      return data;
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!summary) return null;

  const p = summary.paciente;
  const edad = differenceInYears(new Date(), new Date(p.fechaNacimiento));
  const iniciales = `${p.nombre[0]}${p.apellidoPaterno[0]}`;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Back + Header */}
        <div className="flex items-start gap-4">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 shrink-0 mt-0.5">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-xl font-bold shrink-0">
              {iniciales}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">
                  {p.apellidoPaterno} {p.apellidoMaterno}, {p.nombre}
                </h1>
                {p.tieneExpedienteAdicciones && <Chip label="Adicciones" color="amber" />}
                {p.portalActivado && <Chip label="Portal activo" color="green" />}
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                <span>{p.numeroExpediente}</span>
                <span>·</span>
                <span>{edad} años · {p.sexo?.toLowerCase()}</span>
                <span>·</span>
                <span>{p.grupoSanguineo?.replace(/_/g, ' ') ?? 'Tipo sanguíneo desconocido'}</span>
              </div>
            </div>
            {/* Acciones */}
            <div className="flex gap-2">
              <Link href={`/agenda/nueva-cita?pacienteId=${p.id}`}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                <Calendar size={13} /> Agendar
              </Link>
              <Link href={`/consulta/nueva?pacienteId=${p.id}`}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50">
                <FileText size={13} /> Consulta
              </Link>
            </div>
          </div>
        </div>

        {/* Grid de contenido */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Datos personales + Alergias */}
          <div className="space-y-4">
            {/* Datos personales */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <User size={14} className="text-slate-400" /> Datos personales
              </h2>
              <div className="space-y-2">
                <InfoRow label="Fecha nac." value={format(new Date(p.fechaNacimiento), 'dd/MM/yyyy')} />
                <InfoRow label="CURP" value={p.curp} />
                <InfoRow label="RFC" value={p.rfc} />
                <InfoRow label="Teléfono" value={p.telefono} />
                <InfoRow label="Email" value={p.email} />
                <InfoRow label="Estado civil" value={p.estadoCivil} />
                <InfoRow label="Ocupación" value={p.ocupacion} />
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
                <Link href={`/pacientes/${p.id}/arco`} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                  <Shield size={11} /> Exportar ARCO
                </Link>
              </div>
            </div>

            {/* Alergias */}
            {summary.alergias?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h2 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                  <AlertTriangle size={14} /> Alergias conocidas
                </h2>
                <div className="space-y-1.5">
                  {summary.alergias.map((a: any) => (
                    <div key={a.id} className="text-sm text-red-700">
                      <span className="font-medium">{a.agente}</span>
                      {a.reaccion && <span className="text-red-500"> — {a.reaccion}</span>}
                      {a.severidad && (
                        <span className={clsx(
                          'ml-2 text-xs px-1.5 py-0.5 rounded-full',
                          a.severidad === 'anafilaxia' ? 'bg-red-700 text-white' :
                          a.severidad === 'grave' ? 'bg-red-200 text-red-800' :
                          'bg-red-100 text-red-600',
                        )}>
                          {a.severidad}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Medicamentos activos */}
            {summary.medicamentosActivos?.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h2 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <Pill size={14} className="text-slate-400" /> Medicamentos activos
                </h2>
                <div className="space-y-2">
                  {summary.medicamentosActivos.slice(0, 5).map((r: any) =>
                    r.items?.map((item: any) => (
                      <div key={item.id} className="text-sm">
                        <p className="font-medium text-slate-800">{item.medicamentoDci}</p>
                        <p className="text-slate-500 text-xs">{item.dosis} c/{item.frecuencia} · {item.duracionDias} días</p>
                      </div>
                    ))
                  )}
                </div>
                <Link href={`/recetas?pacienteId=${p.id}`} className="text-xs text-blue-600 hover:text-blue-800 mt-2 block">
                  Ver todas las recetas →
                </Link>
              </div>
            )}
          </div>

          {/* Timeline de consultas */}
          <div className="lg:col-span-2 space-y-4">
            {/* Próximas citas */}
            {upcomingCitas?.data?.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h2 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <Calendar size={14} /> Próximas citas
                </h2>
                <div className="space-y-2">
                  {upcomingCitas.data.slice(0, 3).map((c: any) => (
                    <div key={c.id} className="flex items-center gap-3 text-sm text-blue-800">
                      <span className="font-mono text-blue-600 shrink-0">
                        {format(new Date(c.fechaInicio), 'dd/MM HH:mm')}
                      </span>
                      <span>{c.medico?.usuario?.nombre} {c.medico?.usuario?.apellidoPaterno}</span>
                      <span className="text-blue-500 text-xs">{c.tipoCita?.replace(/_/g, ' ')}</span>
                      {c.esTelemedicina && <span>🎥</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Últimas consultas (timeline) */}
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Historial clínico</h2>
                <Link href={`/pacientes/${p.id}/timeline`} className="text-sm text-blue-600 hover:text-blue-800">
                  Ver completo →
                </Link>
              </div>
              <div className="divide-y divide-slate-50">
                {!summary.ultimasConsultas?.length ? (
                  <div className="p-8 text-center text-slate-400">
                    <FileText size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Sin consultas anteriores</p>
                  </div>
                ) : (
                  summary.ultimasConsultas.map((c: any) => (
                    <Link key={c.id} href={`/consulta/${c.id}`}
                      className="block p-4 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-medium text-slate-900">
                              {format(new Date(c.createdAt), "d 'de' MMMM 'de' yyyy", { locale: es })}
                            </span>
                            {c.estado === 'FIRMADA' && (
                              <CheckCircle size={12} className="text-green-500" />
                            )}
                            {c.esTelemedicina && <span className="text-xs text-blue-500">🎥 Telemedicina</span>}
                          </div>

                          {/* Diagnósticos */}
                          {c.diagnosticos?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1">
                              {c.diagnosticos.slice(0, 3).map((d: any) => (
                                <span key={d.id} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                  {d.cie10?.codigo} — {d.cie10?.descripcion?.substring(0, 35)}...
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Nota SOAP preview */}
                          {c.notas?.[0]?.subjetivo && (
                            <p className="text-xs text-slate-500 line-clamp-2">
                              {c.notas[0].subjetivo}
                            </p>
                          )}

                          {/* Signos vitales */}
                          {c.signosVitales && (
                            <div className="flex gap-3 mt-1.5 text-xs text-slate-400 font-mono">
                              {c.signosVitales.taSistolica && (
                                <span>TA {c.signosVitales.taSistolica}/{c.signosVitales.taDiastolica}</span>
                              )}
                              {c.signosVitales.fcLpm && <span>FC {c.signosVitales.fcLpm}</span>}
                              {c.signosVitales.pesoKg && <span>Peso {c.signosVitales.pesoKg}kg</span>}
                              {c.signosVitales.temperaturaC && <span>T° {c.signosVitales.temperaturaC}°C</span>}
                            </div>
                          )}
                        </div>
                        <ExternalLink size={13} className="text-slate-300 group-hover:text-slate-500 shrink-0 mt-0.5" />
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
