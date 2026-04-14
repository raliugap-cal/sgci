'use client';
// ═══════════════════════════════════════════════════════════
// PORTAL — RECETAS /recetas + RESULTADOS /resultados
// ═══════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Pill, FlaskConical, Download, AlertTriangle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { getAll } from '../../lib/offline-store';
import { clsx } from 'clsx';

// ─── Recetas ────────────────────────────────────────────────
export function RecetasPage() {
  const [recetas, setRecetas] = useState<any[]>([]);

  useEffect(() => {
    getAll<any>('prescriptions').then(all => {
      setRecetas(all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-100 px-4 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ArrowLeft size={16} /></Link>
        <h1 className="font-bold text-slate-900">Mis recetas</h1>
      </div>

      <div className="px-4 py-4 max-w-md mx-auto space-y-3">
        {!recetas.length ? (
          <div className="text-center py-12">
            <Pill size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-400 text-sm">Sin recetas disponibles</p>
          </div>
        ) : recetas.map(receta => (
          <div key={receta.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-slate-900 text-sm font-mono">{receta.numeroReceta}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {format(new Date(receta.createdAt), "d 'de' MMMM 'de' yyyy", { locale: es })}
                  </p>
                </div>
                <span className={clsx('text-xs px-2 py-1 rounded-full font-medium',
                  receta.estado === 'ACTIVA' ? 'bg-emerald-100 text-emerald-700' :
                  receta.estado === 'DISPENSADA' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500')}>
                  {receta.estado}
                </span>
              </div>

              <div className="space-y-2">
                {receta.items?.map((item: any) => (
                  <div key={item.id} className="bg-slate-50 rounded-xl p-3">
                    <p className="font-medium text-slate-900 text-sm">{item.medicamentoDci}</p>
                    {item.medicamentoNombreComercial && (
                      <p className="text-xs text-slate-500">{item.medicamentoNombreComercial}</p>
                    )}
                    <div className="flex gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                      <span>{item.dosis}</span>
                      <span>·</span>
                      <span>Cada {item.frecuencia}</span>
                      {item.duracionDias && <><span>·</span><span>{item.duracionDias} días</span></>}
                    </div>
                    {item.indicacionesPaciente && (
                      <p className="text-xs text-blue-600 mt-1">{item.indicacionesPaciente}</p>
                    )}
                    {item.esControlado && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                        Medicamento controlado
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {receta.pdfUrl && (
                <a href={receta.pdfUrl} target="_blank" rel="noreferrer"
                  className="mt-3 flex items-center justify-center gap-2 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50">
                  <Download size={13} /> Descargar receta (PDF)
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export default RecetasPage;
