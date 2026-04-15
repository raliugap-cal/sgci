'use client';
// ═══════════════════════════════════════════════════════════
// ADMIN SERVICIOS NUEVO — /admin/servicios/nuevo
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import AppShell from '../../../../components/AppShell';
import { adminApi } from '../../../../lib/api';

export default function NuevoServicioPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    clave: '', nombre: '', descripcion: '', claveSAT: '',
    claveUnidadSAT: 'E48', precio: '', ivaAplicable: false, tasaIva: 0,
  });

  const createMutation = useMutation({
    mutationFn: () => adminApi.createService({ ...form, precio: Number(form.precio) }),
    onSuccess: () => router.push('/admin?tab=services'),
  });

  const field = (key: string, label: string, placeholder: string, type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <input type={type} value={(form as any)[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
    </div>
  );

  return (
    <AppShell>
      <div className="max-w-xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"><ArrowLeft size={16} /></Link>
          <h1 className="text-xl font-bold text-slate-900">Nuevo servicio</h1>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {field('clave', 'Clave interna *', 'CONSULTA_NUEVA')}
            {field('nombre', 'Nombre *', 'Consulta de primera vez')}
            {field('claveSAT', 'Clave SAT *', '93101601')}
            {field('claveUnidadSAT', 'Clave unidad SAT', 'E48')}
            {field('precio', 'Precio MXN *', '500', 'number')}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Descripción</label>
            <input type="text" value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.ivaAplicable}
              onChange={e => setForm(f => ({ ...f, ivaAplicable: e.target.checked, tasaIva: e.target.checked ? 0.16 : 0 }))} />
            <span className="text-sm text-slate-700">Aplica IVA 16%</span>
          </label>
          <button onClick={() => createMutation.mutate()}
            disabled={!form.clave || !form.nombre || !form.claveSAT || !form.precio || createMutation.isPending}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">
            {createMutation.isPending ? 'Creando...' : 'Crear servicio'}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
