'use client';
// ═══════════════════════════════════════════════════════════
// NUEVA ORDEN DE LABORATORIO — /laboratorio/nueva-orden
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search, Plus, X, FlaskConical } from 'lucide-react';
import Link from 'next/link';
import AppShell from '../../../../components/AppShell';
import { labApi, patientsApi } from '../../../../lib/api';
import { useAuthStore } from '../../../../lib/auth-store';

export default function NuevaOrdenLabPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [busqueda, setBusqueda] = useState('');
  const [paciente, setPaciente] = useState<any>(null);
  const [busquedaEstudio, setBusquedaEstudio] = useState('');
  const [estudios, setEstudios] = useState<any[]>([]);
  const [instrucciones, setInstrucciones] = useState('');

  const { data: pacientes } = useQuery({
    queryKey: ['search-lab', busqueda],
    queryFn: async () => { const { data } = await patientsApi.search({ q: busqueda, limit: 6 }); return data?.data; },
    enabled: busqueda.length >= 2,
  });

  const { data: catalogo } = useQuery({
    queryKey: ['lab-catalog', busquedaEstudio],
    queryFn: async () => { const { data } = await labApi.getCatalog(busquedaEstudio); return data; },
    enabled: busquedaEstudio.length >= 1,
  });

  const createMutation = useMutation({
    mutationFn: () => labApi.createOrder({
      pacienteId: paciente?.id,
      estudioIds: estudios.map(e => e.id),
      instruccionesPaciente: instrucciones || undefined,
    }),
    onSuccess: () => router.push('/laboratorio'),
  });

  const addEstudio = (e: any) => {
    if (!estudios.find(x => x.id === e.id)) setEstudios(prev => [...prev, e]);
    setBusquedaEstudio('');
  };

  return (
    <AppShell>
      <div className="max-w-xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/laboratorio" className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"><ArrowLeft size={16} /></Link>
          <h1 className="text-xl font-bold text-slate-900">Nueva orden de laboratorio</h1>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          {/* Paciente */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Paciente *</label>
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
              <Search size={13} className="text-slate-400 shrink-0" />
              <input type="text" placeholder="Buscar paciente..." value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setPaciente(null); }}
                className="flex-1 text-sm outline-none" />
            </div>
            {pacientes?.map((p: any) => (
              <button key={p.id} type="button" onClick={() => { setPaciente(p); setBusqueda(`${p.apellidoPaterno} ${p.nombre}`); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left text-sm">
                <span className="font-medium text-slate-900">{p.apellidoPaterno} {p.nombre}</span>
                <span className="text-slate-400 text-xs">{p.numeroExpediente}</span>
              </button>
            ))}
          </div>

          {/* Estudios */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Estudios *</label>
            <div className="relative">
              <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
                <FlaskConical size={13} className="text-slate-400 shrink-0" />
                <input type="text" placeholder="Buscar estudio por nombre o clave..."
                  value={busquedaEstudio} onChange={e => setBusquedaEstudio(e.target.value)}
                  className="flex-1 text-sm outline-none" />
              </div>
              {catalogo?.length > 0 && busquedaEstudio && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {catalogo.filter((e: any) => !estudios.find((x: any) => x.id === e.id)).map((e: any) => (
                    <button key={e.id} type="button" onClick={() => addEstudio(e)}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-slate-50 last:border-0 text-sm">
                      <p className="font-medium text-slate-800">{e.nombre}</p>
                      <p className="text-xs text-slate-400">${Number(e.precio).toLocaleString()} · {e.tiempoEntregaHoras}h</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {estudios.length > 0 && (
              <div className="mt-2 space-y-1">
                {estudios.map(e => (
                  <div key={e.id} className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2 text-sm">
                    <span className="text-blue-800 font-medium">{e.nombre}</span>
                    <div className="flex items-center gap-2 text-blue-600">
                      <span className="text-xs">${Number(e.precio).toLocaleString()}</span>
                      <button type="button" onClick={() => setEstudios(prev => prev.filter(x => x.id !== e.id))}
                        className="text-red-400 hover:text-red-600"><X size={13} /></button>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-slate-500 font-medium text-right">
                  Total: ${estudios.reduce((s, e) => s + Number(e.precio), 0).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Instrucciones */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Instrucciones para el paciente</label>
            <textarea value={instrucciones} onChange={e => setInstrucciones(e.target.value)} rows={2}
              placeholder="Ej: Ayuno de 8 horas, no orinar 2 horas antes..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" />
          </div>

          <button onClick={() => createMutation.mutate()}
            disabled={!paciente || estudios.length === 0 || createMutation.isPending}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">
            {createMutation.isPending ? 'Emitiendo...' : `Emitir orden (${estudios.length} estudio${estudios.length !== 1 ? 's' : ''})`}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
