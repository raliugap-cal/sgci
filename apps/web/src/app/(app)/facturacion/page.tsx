'use client';
// ═══════════════════════════════════════════════════════════
// FACTURACIÓN — /facturacion
// Facturas · Timbrado CFDI 4.0 · Registro de pago · Corte
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Receipt, Plus, CheckCircle, Clock, XCircle,
  Download, DollarSign, ChevronRight, AlertCircle,
} from 'lucide-react';
import AppShell from '../../../components/AppShell';
import { billingApi } from '../../../lib/api';
import { clsx } from 'clsx';

const ESTADO_CFDI: Record<string, { label: string; color: string }> = {
  BORRADOR:              { label: 'Borrador',   color: 'bg-slate-100 text-slate-600' },
  TIMBRADO:              { label: 'Timbrado',   color: 'bg-emerald-100 text-emerald-700' },
  CANCELADO:             { label: 'Cancelado',  color: 'bg-red-100 text-red-600' },
  CANCELACION_PENDIENTE: { label: 'Cancel. pend.', color: 'bg-orange-100 text-orange-600' },
};

const ESTADO_PAGO: Record<string, { label: string; color: string }> = {
  PENDIENTE:      { label: 'Pendiente',    color: 'bg-yellow-100 text-yellow-700' },
  PAGADO_PARCIAL: { label: 'Parcial',      color: 'bg-blue-100 text-blue-700' },
  PAGADO:         { label: 'Pagado',       color: 'bg-emerald-100 text-emerald-700' },
  DEVUELTO:       { label: 'Devuelto',     color: 'bg-red-100 text-red-600' },
};

export default function FacturacionPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPagoForm, setShowPagoForm] = useState(false);
  const [pagoData, setPagoData] = useState({ monto: 0, metodoPago: 'EFECTIVO', referencia: '' });
  const [exportMsg, setExportMsg] = useState('');

  const hoy = format(new Date(), 'yyyy-MM-dd');
  const hace30 = format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

  const { data: facturasData, isLoading } = useQuery({
    queryKey: ['facturas'],
    queryFn: async () => {
      const { data } = await billingApi.findAll({ desde: hace30, hasta: hoy, limit: 50 });
      return data;
    },
    refetchInterval: 60000,
  });

  const { data: facturaDetalle } = useQuery({
    queryKey: ['factura', selectedId],
    queryFn: async () => {
      const { data } = await billingApi.findById(selectedId!);
      return data;
    },
    enabled: !!selectedId,
  });

  const stampMutation = useMutation({
    mutationFn: (id: string) => billingApi.stamp(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['facturas', 'factura'] }),
  });

  const pagoMutation = useMutation({
    mutationFn: () => billingApi.registerPayment(selectedId!, pagoData),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['facturas', 'factura'] }); setShowPagoForm(false); },
  });

  const closeMutation = useMutation({
    mutationFn: () => billingApi.closeCashRegister('manana'),
    onSuccess: () => alert('Corte de caja registrado exitosamente'),
  });

  const handleExport = async (formato: string) => {
    setExportMsg('Generando exportación...');
    try {
      await billingApi.export({ desde: hace30, hasta: hoy, formato });
      setExportMsg(`Exportación ${formato} lista`);
      setTimeout(() => setExportMsg(''), 3000);
    } catch { setExportMsg('Error al exportar'); }
  };

  const facturas: any[] = facturasData?.data ?? [];

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Facturación</h1>
            <p className="text-slate-500 text-sm">CFDI 4.0 · SAT · Últimos 30 días</p>
          </div>
          <div className="flex gap-2">
            {/* Exportaciones puente (QB standby) */}
            <div className="relative group">
              <button className="flex items-center gap-2 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50">
                <Download size={14} /> Exportar
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 hidden group-hover:block z-10 w-44">
                {[
                  { label: 'Excel (QB compatible)', fmt: 'xlsx' },
                  { label: 'CSV QuickBooks', fmt: 'csv_qbo' },
                  { label: 'ZIP XMLs CFDI', fmt: 'zip' },
                ].map(({ label, fmt }) => (
                  <button key={fmt} onClick={() => handleExport(fmt)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-700">
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => closeMutation.mutate()}
              className="flex items-center gap-2 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50">
              Corte de caja
            </button>
            <a href="/facturacion/nueva"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              <Plus size={14} /> Nueva factura
            </a>
          </div>
        </div>

        {exportMsg && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">
            {exportMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Lista de facturas */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 text-sm">Facturas recientes</h2>
            </div>
            <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-50">
              {isLoading ? (
                <div className="p-6 text-center text-slate-400 text-sm">Cargando...</div>
              ) : !facturas.length ? (
                <div className="p-8 text-center">
                  <Receipt size={28} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-slate-400 text-sm">Sin facturas en este período</p>
                </div>
              ) : (
                facturas.map(f => (
                  <button key={f.id} onClick={() => setSelectedId(f.id)}
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors',
                      selectedId === f.id && 'bg-blue-50',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-slate-500">{f.numeroFacturaInterno}</span>
                        <span className={clsx('text-xs px-1.5 py-0.5 rounded-full', ESTADO_CFDI[f.estadoCfdi]?.color)}>
                          {ESTADO_CFDI[f.estadoCfdi]?.label}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {f.paciente?.apellidoPaterno}, {f.paciente?.nombre}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-bold text-slate-700">
                          ${Number(f.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </span>
                        <span className={clsx('text-xs px-1.5 py-0.5 rounded-full', ESTADO_PAGO[f.estadoPago]?.color)}>
                          {ESTADO_PAGO[f.estadoPago]?.label}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={13} className="text-slate-300 shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Detalle de factura */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
            {!facturaDetalle ? (
              <div className="flex items-center justify-center h-full min-h-64">
                <div className="text-center text-slate-400">
                  <Receipt size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Seleccione una factura para ver el detalle</p>
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-bold text-slate-900 text-lg">
                      {facturaDetalle.paciente?.apellidoPaterno}, {facturaDetalle.paciente?.nombre}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {facturaDetalle.rfcReceptor ?? 'XAXX010101000'} · {facturaDetalle.numeroFacturaInterno}
                    </p>
                    {facturaDetalle.cfdiUuid && (
                      <p className="text-xs font-mono text-slate-400 mt-0.5">{facturaDetalle.cfdiUuid}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900">
                      ${Number(facturaDetalle.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Saldo: ${Number(facturaDetalle.saldo).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Cargos */}
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-2">Conceptos</h3>
                  <div className="space-y-1">
                    {facturaDetalle.cargos?.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded-lg">
                        <div>
                          <p className="text-slate-800">{c.concepto}</p>
                          <p className="text-xs text-slate-400">{c.claveSAT} · {Number(c.cantidad)} unid.</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-slate-900">
                            ${Number(c.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </p>
                          {c.ivaAplicable && (
                            <p className="text-xs text-slate-400">
                              IVA: ${Number(c.iva).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-slate-100 mt-2">
                    <span className="text-slate-600">Subtotal</span>
                    <span>${Number(facturaDetalle.subtotal).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {Number(facturaDetalle.iva) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">IVA 16%</span>
                      <span>${Number(facturaDetalle.iva).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2 mt-1">
                    <span>Total</span>
                    <span>${Number(facturaDetalle.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex flex-wrap gap-2">
                  {facturaDetalle.estadoCfdi === 'BORRADOR' && (
                    <button onClick={() => stampMutation.mutate(facturaDetalle.id)}
                      disabled={stampMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                      {stampMutation.isPending ? 'Timbrando...' : '🔏 Timbrar CFDI 4.0'}
                    </button>
                  )}
                  {facturaDetalle.estadoCfdi === 'TIMBRADO' && facturaDetalle.estadoPago !== 'PAGADO' && (
                    <button onClick={() => setShowPagoForm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                      <DollarSign size={13} /> Registrar pago
                    </button>
                  )}
                  {facturaDetalle.cfdiPdfUrl && (
                    <a href={facturaDetalle.cfdiPdfUrl} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50">
                      <Download size={13} /> PDF
                    </a>
                  )}
                  {facturaDetalle.cfdiXmlUrl && (
                    <a href={facturaDetalle.cfdiXmlUrl} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50">
                      <Download size={13} /> XML
                    </a>
                  )}
                </div>

                {/* Formulario de pago */}
                {showPagoForm && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                    <h3 className="font-medium text-blue-900 text-sm">Registrar pago</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-600">Monto</label>
                        <input type="number" step="0.01" value={pagoData.monto}
                          onChange={e => setPagoData(d => ({ ...d, monto: +e.target.value }))}
                          className="w-full mt-0.5 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                          max={facturaDetalle.saldo}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600">Método</label>
                        <select value={pagoData.metodoPago}
                          onChange={e => setPagoData(d => ({ ...d, metodoPago: e.target.value }))}
                          className="w-full mt-0.5 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                          <option value="EFECTIVO">Efectivo</option>
                          <option value="TARJETA_DEBITO">Tarjeta débito</option>
                          <option value="TARJETA_CREDITO">Tarjeta crédito</option>
                          <option value="TRANSFERENCIA">Transferencia</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-600">Referencia (opcional)</label>
                      <input type="text" value={pagoData.referencia}
                        onChange={e => setPagoData(d => ({ ...d, referencia: e.target.value }))}
                        placeholder="Número de autorización, folio..."
                        className="w-full mt-0.5 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowPagoForm(false)}
                        className="flex-1 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm">
                        Cancelar
                      </button>
                      <button onClick={() => pagoMutation.mutate()}
                        disabled={pagoMutation.isPending || pagoData.monto <= 0}
                        className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                        {pagoMutation.isPending ? 'Registrando...' : 'Confirmar pago'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Pagos registrados */}
                {facturaDetalle.pagos?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-700 mb-2">Pagos registrados</h3>
                    {facturaDetalle.pagos.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded-lg mb-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle size={13} className="text-emerald-600" />
                          <span className="text-slate-700 capitalize">{p.metodoPago.toLowerCase().replace(/_/g, ' ')}</span>
                          {p.referencia && <span className="text-slate-400 text-xs">· {p.referencia}</span>}
                        </div>
                        <span className="font-medium text-emerald-700">
                          ${Number(p.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
