'use client';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, FlaskConical, Download, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { getAll } from '../../lib/offline-store';
import { clsx } from 'clsx';

export default function ResultadosPage() {
  const [ordenes, setOrdenes] = useState<any[]>([]);

  useEffect(() => {
    getAll<any>('results').then(all =>
      setOrdenes(all.sort((a, b) => new Date(b.fechaEmision).getTime() - new Date(a.fechaEmision).getTime())),
    );
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-100 px-4 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ArrowLeft size={16} /></Link>
        <h1 className="font-bold text-slate-900">Mis resultados</h1>
      </div>
      <div className="px-4 py-4 max-w-md mx-auto space-y-3">
        {!ordenes.length ? (
          <div className="text-center py-12">
            <FlaskConical size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-400 text-sm">Sin resultados disponibles</p>
          </div>
        ) : ordenes.map(orden => (
          <div key={orden.id} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-slate-900 text-sm">
                  {orden.items?.map((i: any) => i.estudio?.nombre).join(', ')}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {format(new Date(orden.fechaEmision), "d 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
              </div>
              <span className={clsx('text-xs px-2 py-1 rounded-full font-medium',
                orden.estado === 'LIBERADA' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                {orden.estado?.replace(/_/g, ' ')}
              </span>
            </div>

            {orden.resultados?.map((r: any) => (
              <div key={r.id} className={clsx('rounded-xl p-3 border',
                r.valorCritico ? 'bg-red-50 border-red-200' :
                r.fueraRango ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100')}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">{r.estudioNombre}</span>
                  <span className="font-bold text-slate-900">{r.valor} {r.unidades}</span>
                </div>
                {r.referenciaNormal && <p className="text-xs text-slate-400 mt-0.5">Ref: {r.referenciaNormal}</p>}
                {r.valorCritico && (
                  <p className="text-xs text-red-700 mt-1 flex items-center gap-1 font-medium">
                    <AlertTriangle size={10} /> Valor crítico — consulte a su médico
                  </p>
                )}
              </div>
            ))}

            {orden.pdfUrl && (
              <a href={orden.pdfUrl} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm">
                <Download size={13} /> Descargar PDF
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
