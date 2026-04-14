'use client';
// ═══════════════════════════════════════════════════════════
// ARCO — /pacientes/[id]/arco
// Exportación de datos personales (Art. 22 LFPDPPP)
// ═══════════════════════════════════════════════════════════
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Shield, Download, FileText, User, Calendar, Receipt } from 'lucide-react';
import Link from 'next/link';
import AppShell from '../../../../../components/AppShell';
import { patientsApi } from '../../../../../lib/api';

export default function ArcoPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['arco', id],
    queryFn: async () => { const { data } = await patientsApi.getArco(id); return data; },
  });

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link href={`/pacientes/${id}`} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Exportación ARCO</h1>
            <p className="text-slate-500 text-sm">Artículo 22 LFPDPPP — Derecho de acceso a datos personales</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <div className="flex items-start gap-2">
            <Shield size={14} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Derechos ARCO — LFPDPPP</p>
              <p>Esta exportación contiene todos los datos personales del paciente registrados en el sistema.
              Su generación queda registrada en la bitácora de auditoría.</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Generando exportación...</p>
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Datos personales */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <User size={14} className="text-slate-400" /> Datos personales
              </h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries({
                  'Nombre': `${data.datosPersonales?.nombre} ${data.datosPersonales?.apellidoPaterno}`,
                  'CURP': data.datosPersonales?.curp ?? '—',
                  'RFC': data.datosPersonales?.rfc ?? '—',
                  'Email': data.datosPersonales?.email ?? '—',
                  'Teléfono': data.datosPersonales?.telefono ?? '—',
                  'Fecha nacimiento': data.datosPersonales?.fechaNacimiento
                    ? format(new Date(data.datosPersonales.fechaNacimiento), 'dd/MM/yyyy')
                    : '—',
                }).map(([k, v]) => (
                  <div key={k}>
                    <span className="text-slate-500 text-xs">{k}</span>
                    <p className="font-medium text-slate-900">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Consentimientos */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <FileText size={14} className="text-slate-400" /> Consentimientos ({data.consentimientos?.length ?? 0})
              </h2>
              {data.consentimientos?.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between text-sm py-2 border-b border-slate-50 last:border-0">
                  <span className="text-slate-700">{c.tipo.replace(/_/g, ' ')}</span>
                  <span className={c.firmado ? 'text-green-600 font-medium' : 'text-amber-600'}>
                    {c.firmado ? `✓ Firmado ${c.firmadoAt ? format(new Date(c.firmadoAt), 'dd/MM/yyyy') : ''}` : 'Pendiente'}
                  </span>
                </div>
              ))}
            </div>

            {/* Historial */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Calendar size={14} className="text-slate-400" /> Historial de citas ({data.historialCitas?.length ?? 0})
              </h2>
              <p className="text-slate-500 text-sm">
                {data.historialCitas?.length ?? 0} citas registradas (se muestran las últimas 10)
              </p>
            </div>

            {/* Facturas */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Receipt size={14} className="text-slate-400" /> Historial de facturación ({data.historialFacturas?.length ?? 0})
              </h2>
              {data.historialFacturas?.map((f: any) => (
                <div key={f.id} className="flex items-center justify-between text-sm py-1">
                  <span className="text-slate-600">{format(new Date(f.fecha), 'dd/MM/yyyy')}</span>
                  <span className="font-medium">${Number(f.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500">
              <p>Exportación generada el {format(new Date(data.fechaExportacion), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}</p>
              <p className="mt-1">{data.nota}</p>
            </div>

            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `arco-${id}-${format(new Date(), 'yyyyMMdd')}.json`;
                a.click();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              <Download size={14} /> Descargar JSON completo
            </button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
