'use client';
// ═══════════════════════════════════════════════════════════
// LABORATORIO — /laboratorio
// Órdenes pendientes · Captura de resultados · Liberación
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  FlaskConical, AlertTriangle, CheckCircle, Clock,
  Plus, ChevronRight, Beaker, Eye, Search,
} from 'lucide-react';
import AppShell from '../../../components/AppShell';
import { labApi } from '../../../lib/api';
import { clsx } from 'clsx';

const ESTADO_ORDEN: Record<string, { label: string; color: string; icon: any }> = {
  EMITIDA:             { label: 'Emitida',        color: 'bg-slate-100 text-slate-600',   icon: Clock },
  EN_ESPERA_MUESTRA:   { label: 'Esp. muestra',   color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  MUESTRA_TOMADA:      { label: 'Muestra tomada', color: 'bg-blue-100 text-blue-700',     icon: Beaker },
  EN_PROCESAMIENTO:    { label: 'Procesando',     color: 'bg-purple-100 text-purple-700', icon: FlaskConical },
  RESULTADO_CAPTURADO: { label: 'Cap. resultado', color: 'bg-amber-100 text-amber-700',   icon: Eye },
  LIBERADA:            { label: 'Liberada',        color: 'bg-green-100 text-green-700',   icon: CheckCircle },
  CANCELADA:           { label: 'Cancelada',       color: 'bg-red-100 text-red-600',       icon: AlertTriangle },
};

function OrdenRow({ orden, onSelect }: { orden: any; onSelect: (o: any) => void }) {
  const cfg = ESTADO_ORDEN[orden.estado] ?? ESTADO_ORDEN.EMITIDA;
  const Icon = cfg.icon;
  const tieneCritico = orden.resultados?.some((r: any) => r.valorCritico);

  return (
    <button onClick={() => onSelect(orden)}
      className="w-full flex items-center gap-4 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 text-left group transition-colors"
    >
      <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', cfg.color)}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-900 truncate">
            {orden.paciente?.nombre} {orden.paciente?.apellidoPaterno}
          </p>
          {tieneCritico && (
            <span className="bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1 shrink-0">
              <AlertTriangle size={10} /> CRÍTICO
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">
          {orden.items?.map((i: any) => i.estudio?.nombre).join(', ')}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          Emitida: {format(parseISO(orden.fechaEmision), "d MMM HH:mm", { locale: es })}
          {orden.codigoBarra && <span className="ml-2 font-mono">· {orden.codigoBarra}</span>}
        </p>
      </div>
      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', cfg.color)}>
        {cfg.label}
      </span>
      <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 shrink-0" />
    </button>
  );
}

function ResultadoForm({ ordenId, items, onDone }: { ordenId: string; items: any[]; onDone: () => void }) {
  const [resultados, setResultados] = useState<Record<string, any>>(
    Object.fromEntries(items.map(i => [i.id, { estudioNombre: i.estudio?.nombre, itemOrdenId: i.id }])),
  );
  const qc = useQueryClient();

  const capturarMutation = useMutation({
    mutationFn: () => labApi.captureResults(ordenId, Object.values(resultados)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lab-ordenes'] }); onDone(); },
  });

  const update = (itemId: string, field: string, value: any) => {
    setResultados(prev => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
  };

  return (
    <div className="space-y-4">
      {items.map(item => (
        <div key={item.id} className="bg-slate-50 rounded-xl p-4 space-y-2">
          <h4 className="font-medium text-slate-900 text-sm">{item.estudio?.nombre}</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500">Valor</label>
              <input type="text" placeholder="ej: 5.2"
                onChange={e => update(item.id, 'valor', e.target.value)}
                className="w-full mt-0.5 px-2 py-1.5 border border-slate-200 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Unidades</label>
              <input type="text" placeholder="ej: g/dL"
                onChange={e => update(item.id, 'unidades', e.target.value)}
                className="w-full mt-0.5 px-2 py-1.5 border border-slate-200 rounded text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500">Rango de referencia</label>
            <input type="text" placeholder="ej: 4.0-6.0"
              onChange={e => update(item.id, 'referenciaNormal', e.target.value)}
              className="w-full mt-0.5 px-2 py-1.5 border border-slate-200 rounded text-sm"
            />
          </div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" onChange={e => update(item.id, 'fueraRango', e.target.checked)} />
              Fuera de rango
            </label>
            <label className="flex items-center gap-1.5 text-red-600 font-medium">
              <input type="checkbox" onChange={e => update(item.id, 'valorCritico', e.target.checked)} />
              Valor crítico ⚠️
            </label>
          </div>
        </div>
      ))}
      <button
        onClick={() => capturarMutation.mutate()}
        disabled={capturarMutation.isPending}
        className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium"
      >
        {capturarMutation.isPending ? 'Guardando...' : 'Guardar resultados'}
      </button>
    </div>
  );
}

export default function LaboratorioPage() {
  const qc = useQueryClient();
  const [selectedOrden, setSelectedOrden] = useState<any>(null);
  const [tab, setTab] = useState<'pendientes' | 'liberadas'>('pendientes');
  const [busqueda, setBusqueda] = useState('');

  const { data: ordenes, isLoading } = useQuery({
    queryKey: ['lab-ordenes', tab],
    queryFn: async () => {
      // En producción: endpoint con filtro por estado
      // Por ahora simulamos con el endpoint general
      return { data: [] };
    },
    refetchInterval: 30000,
  });

  const collectMutation = useMutation({
    mutationFn: (id: string) => labApi.collectSample(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lab-ordenes'] }); setSelectedOrden(null); },
  });

  const releaseMutation = useMutation({
    mutationFn: (id: string) => labApi.release(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lab-ordenes'] }); setSelectedOrden(null); },
  });

  const listaOrdenes: any[] = ordenes?.data ?? [];

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Laboratorio</h1>
            <p className="text-slate-500 text-sm">Órdenes · Resultados · Liberación</p>
          </div>
          <a href="/laboratorio/nueva-orden"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            <Plus size={14} /> Nueva orden
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Lista de órdenes */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 space-y-3">
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                {(['pendientes', 'liberadas'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={clsx('flex-1 py-1 rounded-md text-xs font-medium capitalize transition-colors',
                      tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2 py-1.5">
                <Search size={12} className="text-slate-400" />
                <input type="text" placeholder="Buscar paciente..."
                  value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  className="bg-transparent text-xs outline-none flex-1" />
              </div>
            </div>

            <div className="max-h-[500px] overflow-y-auto">
              {isLoading ? (
                <div className="p-6 text-center text-slate-400 text-sm">Cargando...</div>
              ) : !listaOrdenes.length ? (
                <div className="p-8 text-center">
                  <FlaskConical size={28} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-slate-400 text-sm">Sin órdenes {tab}</p>
                </div>
              ) : (
                listaOrdenes.map(o => (
                  <OrdenRow key={o.id} orden={o} onSelect={setSelectedOrden} />
                ))
              )}
            </div>
          </div>

          {/* Panel de detalle */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
            {!selectedOrden ? (
              <div className="flex items-center justify-center h-full min-h-64">
                <div className="text-center text-slate-400">
                  <FlaskConical size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Seleccione una orden para ver el detalle</p>
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-bold text-slate-900">
                      {selectedOrden.paciente?.nombre} {selectedOrden.paciente?.apellidoPaterno}
                    </h2>
                    <p className="text-sm text-slate-500 font-mono">{selectedOrden.codigoBarra}</p>
                  </div>
                  <span className={clsx(
                    'text-xs px-2 py-1 rounded-full font-medium',
                    ESTADO_ORDEN[selectedOrden.estado]?.color,
                  )}>
                    {ESTADO_ORDEN[selectedOrden.estado]?.label}
                  </span>
                </div>

                {/* Estudios solicitados */}
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-slate-700">Estudios</h3>
                  {selectedOrden.items?.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded-lg">
                      <span className="text-slate-700">{item.estudio?.nombre}</span>
                      <span className="text-slate-400 text-xs">{item.estudio?.tiempoEntregaHoras}h entrega</span>
                    </div>
                  ))}
                </div>

                {/* Acciones según estado */}
                <div className="space-y-2">
                  {selectedOrden.estado === 'EMITIDA' && (
                    <button onClick={() => collectMutation.mutate(selectedOrden.id)}
                      disabled={collectMutation.isPending}
                      className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium">
                      {collectMutation.isPending ? 'Registrando...' : '🧪 Registrar toma de muestra'}
                    </button>
                  )}

                  {selectedOrden.estado === 'MUESTRA_TOMADA' && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-700 mb-3">Capturar resultados</h3>
                      <ResultadoForm
                        ordenId={selectedOrden.id}
                        items={selectedOrden.items ?? []}
                        onDone={() => setSelectedOrden(null)}
                      />
                    </div>
                  )}

                  {selectedOrden.estado === 'RESULTADO_CAPTURADO' && (
                    <div className="space-y-3">
                      {selectedOrden.resultados?.map((r: any) => (
                        <div key={r.id} className={clsx(
                          'p-3 rounded-lg border',
                          r.valorCritico ? 'border-red-300 bg-red-50' : r.fueraRango ? 'border-amber-300 bg-amber-50' : 'border-slate-200',
                        )}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-800">{r.estudioNombre}</span>
                            <span className="font-bold text-slate-900">{r.valor} {r.unidades}</span>
                          </div>
                          {r.referenciaNormal && <p className="text-xs text-slate-500 mt-0.5">Ref: {r.referenciaNormal}</p>}
                          {r.valorCritico && (
                            <span className="text-xs text-red-700 font-medium flex items-center gap-1 mt-1">
                              <AlertTriangle size={10} /> VALOR CRÍTICO — Notificar al médico inmediatamente
                            </span>
                          )}
                        </div>
                      ))}
                      <button onClick={() => releaseMutation.mutate(selectedOrden.id)}
                        disabled={releaseMutation.isPending}
                        className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium">
                        {releaseMutation.isPending ? 'Liberando...' : '✓ Liberar resultados al médico'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
