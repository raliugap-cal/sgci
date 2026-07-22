'use client';
// ═══════════════════════════════════════════════════════════
// ALMACÉN / FARMACIA — /almacen
// Inventario · Entradas · Salidas · Alertas · Caducidades
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package, Plus, ArrowDown, ArrowUp, AlertTriangle,
  Clock, Search, BarChart3, Boxes,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useForm } from 'react-hook-form';

// ── API helpers ────────────────────────────────────────────
const almacenApi = {
  findAll:     (params: any) => api.get('/almacen/productos', { params }),
  create:      (data: any)   => api.post('/almacen/productos', data),
  entrada:     (id: string, data: any) => api.post(`/almacen/productos/${id}/entrada`, data),
  salida:      (id: string, data: any) => api.post(`/almacen/productos/${id}/salida`, data),
  ajuste:      (id: string, data: any) => api.post(`/almacen/productos/${id}/ajuste`, data),
  addLote:     (id: string, data: any) => api.post(`/almacen/productos/${id}/lotes`, data),
  alertas:     () => api.get('/almacen/alertas'),
  caducidades: (dias: number) => api.get('/almacen/caducidades', { params: { dias } }),
};

type Tab = 'inventario' | 'alertas' | 'caducidades';

// ── Formulario movimiento ──────────────────────────────────
function MovimientoModal({ producto, tipo, onClose, onSuccess }: any) {
  const { register, handleSubmit } = useForm();

  const mutation = useMutation({
    mutationFn: (d: any) => tipo === 'entrada'
      ? almacenApi.entrada(producto.id, d)
      : almacenApi.salida(producto.id, d),
    onSuccess: () => { onSuccess(); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className={clsx('font-bold mb-1 flex items-center gap-2',
          tipo === 'entrada' ? 'text-green-700' : 'text-red-700')}>
          {tipo === 'entrada' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
          {tipo === 'entrada' ? 'Registrar entrada' : 'Registrar salida'}
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          {producto.nombre} · Stock actual: <strong>{Number(producto.stock)} {producto.unidad}</strong>
        </p>

        <form onSubmit={handleSubmit(d => mutation.mutate({ ...d, cantidad: Number(d.cantidad) }))} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Cantidad ({producto.unidad}) *
            </label>
            <input type="number" step="0.001" min="0.001"
              {...register('cantidad', { required: true, min: 0.001 })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Motivo</label>
            <input {...register('motivo')}
              placeholder={tipo === 'entrada' ? 'Compra, donación...' : 'Uso en consulta, caducado...'}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Referencia</label>
            <input {...register('referencia')}
              placeholder="No. de factura, ID paciente..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>

          {mutation.isError && (
            <p className="text-red-600 text-sm">
              {(mutation.error as any)?.response?.data?.message ?? 'Error'}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending}
              className={clsx('flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50',
                tipo === 'entrada' ? 'bg-green-600' : 'bg-red-600')}>
              {mutation.isPending ? 'Guardando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Formulario nuevo producto ──────────────────────────────
function NuevoProductoModal({ onClose, onSuccess }: any) {
  const { register, handleSubmit } = useForm();
  const mutation = useMutation({
    mutationFn: (d: any) => almacenApi.create({ ...d, stockMinimo: Number(d.stockMinimo) }),
    onSuccess: () => { onSuccess(); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="font-bold text-slate-900 mb-5">Nuevo producto / medicamento</h3>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Nombre *</label>
              <input {...register('nombre', { required: true })}
                placeholder="Amoxicilina 500mg cápsula"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Categoría</label>
              <select {...register('categoria')} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                <option value="medicamento">Medicamento</option>
                <option value="insumo">Insumo médico</option>
                <option value="equipo">Equipo/Consumible</option>
                <option value="laboratorio">Laboratorio</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Unidad *</label>
              <input {...register('unidad', { required: true })}
                placeholder="cápsulas, ml, piezas..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Principio activo</label>
              <input {...register('principioActivo')}
                placeholder="Amoxicilina"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Stock mínimo *</label>
              <input type="number" min="0" {...register('stockMinimo', { required: true })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Precio unitario</label>
              <input type="number" step="0.01" min="0" {...register('precio')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...register('requiereReceta')} className="rounded" />
              Requiere receta
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...register('esControlado')} className="rounded" />
              Controlado
            </label>
          </div>

          {mutation.isError && (
            <p className="text-red-600 text-sm">
              {(mutation.error as any)?.response?.data?.message ?? 'Error'}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {mutation.isPending ? 'Creando...' : 'Crear producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────
export default function AlmacenPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('inventario');
  const [q, setQ] = useState('');
  const [bajoMinimo, setBajoMinimo] = useState(false);
  const [showNuevo, setShowNuevo] = useState(false);
  const [movimiento, setMovimiento] = useState<{ producto: any; tipo: 'entrada' | 'salida' } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['almacen', q, bajoMinimo],
    queryFn: async () => {
      const { data } = await almacenApi.findAll({ q: q || undefined, bajoMinimo: bajoMinimo || undefined, limit: 50 });
      return data;
    },
    enabled: tab === 'inventario',
  });

  const { data: alertasData } = useQuery({
    queryKey: ['almacen-alertas'],
    queryFn: async () => { const { data } = await almacenApi.alertas(); return data; },
    enabled: tab === 'alertas',
  });

  const { data: caducidadesData } = useQuery({
    queryKey: ['almacen-caducidades'],
    queryFn: async () => { const { data } = await almacenApi.caducidades(30); return data; },
    enabled: tab === 'caducidades',
  });

  const productos = data?.data ?? [];

  const tabs = [
    { id: 'inventario', label: 'Inventario', icon: Boxes },
    { id: 'alertas', label: 'Alertas', icon: AlertTriangle },
    { id: 'caducidades', label: 'Caducidades', icon: Clock },
  ] as const;

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Package size={22} /> Almacén / Farmacia
            </h1>
            <p className="text-slate-500 text-sm mt-1">{data?.meta?.total ?? 0} productos registrados</p>
          </div>
          <button onClick={() => setShowNuevo(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
            <Plus size={15} /> Nuevo producto
          </button>
        </div>

        {/* KPIs rápidos */}
        {alertasData && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{data?.meta?.total ?? 0}</p>
              <p className="text-xs text-slate-500">Productos totales</p>
            </div>
            <div className={clsx('rounded-xl border p-4 text-center',
              alertasData.totalBajoMinimo > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200')}>
              <p className={clsx('text-2xl font-bold', alertasData.totalBajoMinimo > 0 ? 'text-amber-600' : 'text-slate-900')}>
                {alertasData.totalBajoMinimo}
              </p>
              <p className="text-xs text-slate-500">Bajo mínimo</p>
            </div>
            <div className={clsx('rounded-xl border p-4 text-center',
              alertasData.totalAgotados > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200')}>
              <p className={clsx('text-2xl font-bold', alertasData.totalAgotados > 0 ? 'text-red-600' : 'text-slate-900')}>
                {alertasData.totalAgotados}
              </p>
              <p className="text-xs text-slate-500">Agotados</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={clsx('flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium flex-1 justify-center transition-colors',
                tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Tab: Inventario */}
        {tab === 'inventario' && (
          <>
            <div className="flex gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={e => setQ(e.target.value)}
                  placeholder="Buscar producto..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer px-3 py-2 border border-slate-200 rounded-lg">
                <input type="checkbox" checked={bajoMinimo} onChange={e => setBajoMinimo(e.target.checked)} className="rounded" />
                Solo bajo mínimo
              </label>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-[2fr_1fr_1fr_120px] text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3 border-b border-slate-100">
                <span>Producto</span>
                <span className="text-center">Stock</span>
                <span className="text-center">Mínimo</span>
                <span className="text-center">Acciones</span>
              </div>
              {isLoading ? (
                <div className="p-8 text-center text-slate-400">Cargando...</div>
              ) : !productos.length ? (
                <div className="p-12 text-center">
                  <Package size={36} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-400">Sin productos registrados</p>
                </div>
              ) : productos.map((p: any) => (
                <div key={p.id} className="grid grid-cols-[2fr_1fr_1fr_120px] items-center px-4 py-3 border-b border-slate-50 hover:bg-slate-50">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{p.nombre}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium',
                        p.estadoStock === 'AGOTADO' ? 'bg-red-100 text-red-700' :
                        p.estadoStock === 'BAJO_MINIMO' ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700')}>
                        {p.estadoStock === 'AGOTADO' ? '⚠ Agotado' :
                         p.estadoStock === 'BAJO_MINIMO' ? '↓ Bajo mínimo' : '✓ Disponible'}
                      </span>
                      <span className="text-xs text-slate-400">{p.unidad}</span>
                    </div>
                  </div>
                  <p className={clsx('text-center font-bold font-mono text-sm',
                    Number(p.stock) <= 0 ? 'text-red-600' :
                    Number(p.stock) <= Number(p.stockMinimo) ? 'text-amber-600' : 'text-slate-900')}>
                    {Number(p.stock)}
                  </p>
                  <p className="text-center text-sm text-slate-400">{Number(p.stockMinimo)}</p>
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setMovimiento({ producto: p, tipo: 'entrada' })}
                      title="Entrada"
                      className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
                      <ArrowDown size={13} />
                    </button>
                    <button onClick={() => setMovimiento({ producto: p, tipo: 'salida' })}
                      title="Salida"
                      className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                      <ArrowUp size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Tab: Alertas */}
        {tab === 'alertas' && alertasData && (
          <div className="space-y-3">
            {!alertasData.bajoMinimo?.length ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
                <CheckIcon className="mx-auto text-green-400 mb-2" />
                <p className="text-green-700 font-medium">¡Todo el inventario está sobre el mínimo!</p>
              </div>
            ) : alertasData.bajoMinimo.map((p: any) => (
              <div key={p.id} className={clsx('bg-white border rounded-xl p-4 flex items-center gap-4',
                p.estado === 'AGOTADO' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50')}>
                <AlertTriangle size={20} className={p.estado === 'AGOTADO' ? 'text-red-500' : 'text-amber-500'} />
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{p.nombre}</p>
                  <p className="text-sm text-slate-500">
                    Stock: <strong className={p.estado === 'AGOTADO' ? 'text-red-600' : 'text-amber-600'}>{Number(p.stock)} {p.unidad}</strong>
                    {' '}· Mínimo: {Number(p.stockMinimo)} {p.unidad}
                  </p>
                </div>
                <button onClick={() => setMovimiento({ producto: p, tipo: 'entrada' })}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium">
                  + Entrada
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Caducidades */}
        {tab === 'caducidades' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-amber-50">
              <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
                <Clock size={14} /> Lotes que caducan en los próximos 30 días
              </p>
            </div>
            {!caducidadesData?.length ? (
              <div className="p-8 text-center text-slate-400">Sin lotes próximos a caducar</div>
            ) : caducidadesData.map((lote: any) => (
              <div key={lote.id} className="flex items-center gap-4 px-4 py-3 border-b border-slate-50">
                <div className="flex-1">
                  <p className="font-medium text-slate-900 text-sm">{lote.inventario.nombre}</p>
                  <p className="text-xs text-slate-400">Lote: {lote.numeroLote} · {lote.proveedor ?? 'Sin proveedor'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-amber-600">{Number(lote.cantidad)} {lote.inventario.unidad}</p>
                  <p className="text-xs text-slate-400">
                    Caduca: {format(new Date(lote.fechaCaducidad), "d 'de' MMMM", { locale: es })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showNuevo && (
        <NuevoProductoModal
          onClose={() => setShowNuevo(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['almacen'] })}
        />
      )}

      {movimiento && (
        <MovimientoModal
          producto={movimiento.producto}
          tipo={movimiento.tipo}
          onClose={() => setMovimiento(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['almacen'] });
            qc.invalidateQueries({ queryKey: ['almacen-alertas'] });
          }}
        />
      )}
    </AppShell>
  );
}

// Ícono check inline
function CheckIcon({ className }: { className?: string }) {
  return <svg className={clsx('w-10 h-10', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>;
}
