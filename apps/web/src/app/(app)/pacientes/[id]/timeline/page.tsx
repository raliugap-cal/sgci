'use client';
// ═══════════════════════════════════════════════════════════
// TIMELINE CLÍNICO — /pacientes/[id]/timeline
// Historial completo paginado de consultas del paciente
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft, FileText, Video, ChevronRight, CheckCircle,
  Stethoscope, Pill, FlaskConical, Heart,
} from 'lucide-react';
import Link from 'next/link';
import AppShell from '../../../../components/AppShell';
import { patientsApi } from '../../../../lib/api';
import { clsx } from 'clsx';

function TimelineEntry({ consulta }: { consulta: any }) {
  const [expanded, setExpanded] = useState(false);
  const fecha = new Date(consulta.createdAt);

  return (
    <div className="relative pl-8">
      {/* Línea vertical */}
      <div className="absolute left-3 top-8 bottom-0 w-px bg-slate-200" />
      {/* Dot */}
      <div className={clsx(
        'absolute left-0 top-6 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white',
        consulta.estado === 'FIRMADA' ? 'bg-emerald-500' : 'bg-slate-300',
      )}>
        {consulta.esTelemedicina
          ? <Video size={10} className="text-white" />
          : <Stethoscope size={10} className="text-white" />}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 mb-4 overflow-hidden">
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-start gap-4 p-4 text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm font-bold text-slate-900">
                {format(fecha, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
              </span>
              {consulta.estado === 'FIRMADA' && (
                <CheckCircle size={13} className="text-emerald-500 shrink-0" />
              )}
              {consulta.esTelemedicina && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  🎥 Telemedicina
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Dr(a). {consulta.medico?.usuario?.nombre} {consulta.medico?.usuario?.apellidoPaterno}
              {' · '}{consulta.sede?.nombre}
            </p>

            {/* Diagnósticos */}
            {consulta.diagnosticos?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {consulta.diagnosticos.slice(0, 3).map((d: any) => (
                  <span key={d.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                    {d.cie10?.codigo}
                  </span>
                ))}
                {consulta.diagnosticos.length > 3 && (
                  <span className="text-xs text-slate-400">+{consulta.diagnosticos.length - 3} más</span>
                )}
              </div>
            )}
          </div>
          <ChevronRight size={14} className={clsx('text-slate-400 shrink-0 mt-1 transition-transform', expanded && 'rotate-90')} />
        </button>

        {/* Contenido expandido */}
        {expanded && (
          <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-4">
            {/* Signos vitales */}
            {consulta.signosVitales && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Signos vitales</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'TA', value: consulta.signosVitales.taSistolica ? `${consulta.signosVitales.taSistolica}/${consulta.signosVitales.taDiastolica}` : null, unit: 'mmHg' },
                    { label: 'FC', value: consulta.signosVitales.fcLpm, unit: 'lpm' },
                    { label: 'Peso', value: consulta.signosVitales.pesoKg, unit: 'kg' },
                    { label: 'T°', value: consulta.signosVitales.temperaturaC, unit: '°C' },
                  ].filter(v => v.value).map(({ label, value, unit }) => (
                    <div key={label} className="bg-slate-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-slate-400">{label}</p>
                      <p className="text-sm font-bold text-slate-900">{value}</p>
                      <p className="text-xs text-slate-400">{unit}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notas SOAP */}
            {consulta.notas?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Nota clínica</p>
                {consulta.notas.slice(0, 1).map((nota: any) => (
                  <div key={nota.id} className="space-y-2">
                    {nota.subjetivo && (
                      <div>
                        <span className="text-xs font-medium text-slate-600">S — Subjetivo: </span>
                        <span className="text-sm text-slate-800">{nota.subjetivo}</span>
                      </div>
                    )}
                    {nota.plan && (
                      <div>
                        <span className="text-xs font-medium text-slate-600">P — Plan: </span>
                        <span className="text-sm text-slate-800">{nota.plan}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Diagnósticos detalle */}
            {consulta.diagnosticos?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Diagnósticos</p>
                <div className="space-y-1">
                  {consulta.diagnosticos.map((d: any) => (
                    <div key={d.id} className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-blue-600 text-xs bg-blue-50 px-1.5 py-0.5 rounded">
                        {d.cie10?.codigo}
                      </span>
                      <span className="text-slate-700">{d.cie10?.descripcion}</span>
                      <span className={clsx('text-xs ml-auto capitalize',
                        d.tipo === 'principal' ? 'text-slate-700 font-medium' : 'text-slate-400')}>
                        {d.tipo}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Link href={`/consulta/${consulta.id}`}
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800">
              <FileText size={12} /> Ver consulta completa →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TimelinePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['patient-timeline', id, page],
    queryFn: async () => {
      const { data } = await patientsApi.timeline(id, page);
      return data;
    },
  });

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/pacientes/${id}`} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500">
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Historial clínico</h1>
              {data?.meta && (
                <p className="text-slate-500 text-sm">{data.meta.total} consultas registradas</p>
              )}
            </div>
          </div>
          <Link href={`/consulta/nueva?pacienteId=${id}`}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            <Stethoscope size={13} /> Nueva consulta
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !data?.data?.length ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Stethoscope size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">Sin consultas registradas</p>
          </div>
        ) : (
          <div>
            {data.data.map((consulta: any) => (
              <TimelineEntry key={consulta.id} consulta={consulta} />
            ))}

            {/* Paginación */}
            {data.meta?.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  Página {data.meta.page} de {data.meta.totalPages}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={!data.meta.hasPrev}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">
                    ← Anterior
                  </button>
                  <button onClick={() => setPage(p => p + 1)}
                    disabled={!data.meta.hasNext}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">
                    Siguiente →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
