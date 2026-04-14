'use client';
// ═══════════════════════════════════════════════════════════
// NUEVA FACTURA — /facturacion/nueva
// Pre-factura independiente (sin consulta vinculada)
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';
import AppShell from '../../../../components/AppShell';
import { billingApi, patientsApi } from '../../../../lib/api';

export default function NuevaFacturaPage() {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [paciente, setPaciente] = useState<any>(null);
  const [form, setForm] = useState({ rfcReceptor: '', razonSocialReceptor: '', usoCfdi: 'G03', regimenFiscalReceptor: '616' });

  const { data: pacientes } = useQuery({
    queryKey: ['search-billing', busqueda],
    queryFn: async () => { const { data } = await patientsApi.search({ q: busqueda, limit: 6 }); return data?.data; },
    enabled: busqueda.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: () => billingApi.create({ pacienteId: paciente?.id, ...form }),
    onSuccess: (res) => router.push(`/facturacion?facturaId=${res.data.id}`),
  });

  return (
    <AppShell>
      <div className="max-w-xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/facturacion" className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"><ArrowLeft size={16} /></Link>
          <h1 className="text-xl font-bold text-slate-900">Nueva factura</h1>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Paciente *</label>
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
              <Search size={13} className="text-slate-400 shrink-0" />
              <input type="text" placeholder="Buscar paciente..." value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setPaciente(null); }}
                className="flex-1 text-sm outline-none" />
            </div>
            {pacientes?.map((p: any) => (
              <button key={p.id} type="button" onClick={() => {
                setPaciente(p);
                setBusqueda(`${p.apellidoPaterno} ${p.nombre}`);
                if (p.rfc) setForm(f => ({ ...f, rfcReceptor: p.rfc }));
              }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left text-sm rounded-lg">
                <span className="font-medium text-slate-900">{p.apellidoPaterno} {p.nombre}</span>
                <span className="text-slate-400">{p.numeroExpediente}</span>
              </button>
            ))}
          </div>

          {[
            { key: 'rfcReceptor', label: 'RFC del receptor', placeholder: 'XAXX010101000 para público en general' },
            { key: 'razonSocialReceptor', label: 'Razón social', placeholder: 'Nombre del receptor del CFDI' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
              <input type="text" value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Uso de CFDI</label>
              <select value={form.usoCfdi} onChange={e => setForm(f => ({ ...f, usoCfdi: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                <option value="G03">G03 — Gastos en general</option>
                <option value="D01">D01 — Honorarios médicos</option>
                <option value="D07">D07 — Gastos médicos (seguros)</option>
                <option value="S01">S01 — Sin efectos fiscales</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Régimen fiscal receptor</label>
              <select value={form.regimenFiscalReceptor} onChange={e => setForm(f => ({ ...f, regimenFiscalReceptor: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                <option value="616">616 — Sin obligaciones</option>
                <option value="605">605 — Sueldos y salarios</option>
                <option value="612">612 — Actividad empresarial</option>
                <option value="626">626 — RESICO</option>
              </select>
            </div>
          </div>

          <button onClick={() => createMutation.mutate()} disabled={!paciente || createMutation.isPending}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">
            {createMutation.isPending ? 'Creando...' : 'Crear pre-factura →'}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
