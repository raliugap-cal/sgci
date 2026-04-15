'use client';
// ═══════════════════════════════════════════════════════════
// PACIENTES — /pacientes
// Búsqueda · Listado · Crear · Ver expediente
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, differenceInYears } from 'date-fns';
import {
  Search, Plus, User, FileText, Calendar, Phone,
  ChevronRight, Filter, AlertTriangle,
} from 'lucide-react';
import AppShell from '../../../components/AppShell';
import { patientsApi } from '../../../lib/api';
import { clsx } from 'clsx';

function AgeChip({ fecha }: { fecha: string }) {
  const edad = differenceInYears(new Date(), new Date(fecha));
  return <span className="text-slate-500 text-xs">{edad} años</span>;
}

export default function PacientesPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [curp, setCurp] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['patients', q, curp, page],
    queryFn: async () => {
      const { data } = await patientsApi.search({ q, curp, page, limit: 20 });
      return data;
    },
    staleTime: 30000,
  });

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Pacientes</h1>
            <p className="text-slate-500 text-sm">
              {data?.meta?.total != null ? `${data.meta.total} registros` : 'Cargando...'}
            </p>
          </div>
          <Link
            href="/pacientes/nuevo"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} /> Nuevo paciente
          </Link>
        </div>

        {/* Buscador */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Buscar por nombre o número de expediente..."
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                className="bg-transparent text-sm outline-none flex-1 placeholder:text-slate-400"
              />
            </div>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors',
                showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
              )}
            >
              <Filter size={14} /> Filtros
            </button>
          </div>

          {showFilters && (
            <div className="flex gap-3 pt-1">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex-1">
                <span className="text-xs text-slate-500 shrink-0">CURP:</span>
                <input
                  type="text"
                  placeholder="ABCD123456HDFXXX00"
                  value={curp}
                  onChange={(e) => { setCurp(e.target.value.toUpperCase()); setPage(1); }}
                  className="bg-transparent text-sm outline-none flex-1 font-mono placeholder:text-slate-400"
                  maxLength={18}
                />
              </div>
            </div>
          )}
        </div>

        {/* Lista */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Buscando pacientes...</p>
            </div>
          ) : !data?.data?.length ? (
            <div className="p-12 text-center">
              <User size={36} className="mx-auto mb-3 text-slate-300" />
              <p className="text-slate-500 text-sm">No se encontraron pacientes</p>
              {q && <p className="text-slate-400 text-xs mt-1">Intente con otro nombre o número de expediente</p>}
            </div>
          ) : (
            <div>
              {/* Table header */}
              <div className="grid grid-cols-12 gap-3 px-4 py-2 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wide">
                <span className="col-span-1">Exp.</span>
                <span className="col-span-4">Nombre</span>
                <span className="col-span-2">Nacimiento</span>
                <span className="col-span-2">Sexo</span>
                <span className="col-span-2">Portal</span>
                <span className="col-span-1"></span>
              </div>

              {data.data.map((p: any) => (
                <Link key={p.id} href={`/pacientes/${p.id}`}
                  className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 items-center group transition-colors"
                >
                  <span className="col-span-1 text-xs font-mono text-slate-500">{p.numeroExpediente}</span>

                  <div className="col-span-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                        {p.nombre[0]}{p.apellidoPaterno[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {p.apellidoPaterno} {p.apellidoMaterno}, {p.nombre}
                        </p>
                        {p.tieneExpedienteAdicciones && (
                          <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full">
                            Adicciones
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <p className="text-sm text-slate-700">{format(new Date(p.fechaNacimiento), 'dd/MM/yyyy')}</p>
                    <AgeChip fecha={p.fechaNacimiento} />
                  </div>

                  <span className="col-span-2 text-sm text-slate-600 capitalize">
                    {p.sexo.toLowerCase()}
                  </span>

                  <div className="col-span-2">
                    {p.portalActivado ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Activo</span>
                    ) : (
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Sin portal</span>
                    )}
                  </div>

                  <div className="col-span-1 flex justify-end">
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {data?.meta && data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Página {data.meta.page} de {data.meta.totalPages} — {data.meta.total} registros
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={!data.meta.hasPrev}
                  className="px-3 py-1 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={!data.meta.hasNext}
                  className="px-3 py-1 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
