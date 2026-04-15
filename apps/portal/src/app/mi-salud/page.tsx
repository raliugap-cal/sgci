'use client';
// ═══════════════════════════════════════════════════════════
// MI SALUD — /mi-salud
// Diagnósticos activos · Alergias · Medicamentos
// Disponible OFFLINE desde caché IndexedDB
// ═══════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Pill, Stethoscope, Info, Shield } from 'lucide-react';
import { getAll } from '../../lib/offline-store';
import { clsx } from 'clsx';

function Section({ title, icon: Icon, color, children, empty }: any) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className={clsx('flex items-center gap-2 px-4 py-3 border-b', color)}>
        <Icon size={14} />
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      {children ? (
        <div className="divide-y divide-slate-50">{children}</div>
      ) : (
        <div className="p-6 text-center text-slate-400 text-sm">{empty}</div>
      )}
    </div>
  );
}

export default function MiSaludPage() {
  const [diagnoses, setDiagnoses] = useState<any[]>([]);
  const [allergies, setAllergies] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [d, a, p] = await Promise.all([
        getAll<any>('diagnoses'),
        getAll<any>('allergies'),
        getAll<any>('prescriptions'),
      ]);
      setDiagnoses(d.filter(x => ['activo', 'cronico'].includes(x.estado)));
      setAllergies(a.filter(x => x.activa !== false));
      setPrescriptions(p.filter(x => x.estado === 'ACTIVA'));
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-100 px-4 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="font-bold text-slate-900">Mi salud</h1>
          <p className="text-xs text-slate-500">Información disponible sin conexión</p>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4 max-w-md mx-auto">

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="bg-slate-200 h-24 rounded-2xl animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* Alergias — primero por seguridad */}
            <Section
              title="Alergias conocidas"
              icon={AlertTriangle}
              color="border-red-100 bg-red-50 text-red-700"
              empty="Sin alergias registradas"
            >
              {allergies.length > 0 && allergies.map(a => (
                <div key={a.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{a.agente}</p>
                      {a.reaccion && <p className="text-xs text-slate-500 mt-0.5">{a.reaccion}</p>}
                    </div>
                    {a.severidad && (
                      <span className={clsx(
                        'text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
                        a.severidad === 'anafilaxia' ? 'bg-red-700 text-white' :
                        a.severidad === 'grave' ? 'bg-red-200 text-red-800' :
                        'bg-orange-100 text-orange-700',
                      )}>
                        {a.severidad}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </Section>

            {/* Diagnósticos activos */}
            <Section
              title="Diagnósticos activos"
              icon={Stethoscope}
              color="border-blue-100 bg-blue-50 text-blue-700"
              empty="Sin diagnósticos activos registrados"
            >
              {diagnoses.length > 0 && diagnoses.map(d => (
                <div key={d.id} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
                      {d.cie10?.codigo}
                    </span>
                    <div>
                      <p className="text-sm text-slate-900">{d.cie10?.descripcion}</p>
                      <p className="text-xs text-slate-500 mt-0.5 capitalize">{d.tipo} · {d.estado}</p>
                    </div>
                  </div>
                </div>
              ))}
            </Section>

            {/* Medicamentos activos */}
            <Section
              title="Medicamentos actuales"
              icon={Pill}
              color="border-purple-100 bg-purple-50 text-purple-700"
              empty="Sin medicamentos activos"
            >
              {prescriptions.length > 0 && prescriptions.flatMap(r =>
                (r.items ?? []).map((item: any) => (
                  <div key={item.id} className="px-4 py-3">
                    <p className="font-medium text-slate-900 text-sm">{item.medicamentoDci}</p>
                    {item.medicamentoNombreComercial && (
                      <p className="text-xs text-slate-500">{item.medicamentoNombreComercial}</p>
                    )}
                    <div className="flex gap-3 mt-1 text-xs text-slate-500">
                      <span>{item.dosis}</span>
                      <span>·</span>
                      <span>c/{item.frecuencia}</span>
                      {item.duracionDias && <><span>·</span><span>{item.duracionDias} días</span></>}
                    </div>
                    {item.indicacionesPaciente && (
                      <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                        <Info size={10} /> {item.indicacionesPaciente}
                      </p>
                    )}
                    {item.esControlado && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                        Controlado
                      </span>
                    )}
                  </div>
                ))
              )}
            </Section>

            {/* Aviso LFPDPPP */}
            <div className="flex items-start gap-2 bg-slate-100 rounded-xl p-3 text-xs text-slate-500">
              <Shield size={12} className="shrink-0 mt-0.5" />
              Información protegida conforme a la LFPDPPP. Solo visible para usted en este dispositivo.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
