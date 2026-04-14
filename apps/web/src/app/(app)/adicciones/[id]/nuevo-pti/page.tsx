'use client';
// /adicciones/[id]/nuevo-pti — Plan de Tratamiento Individual
import { useParams, useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { ArrowLeft, Plus, X } from 'lucide-react';
import Link from 'next/link';
import AppShell from '../../../../../components/AppShell';
import { addictionsApi } from '../../../../../lib/api';

export default function NuevoPTIPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { register, handleSubmit, control } = useForm({
    defaultValues: {
      modalidad: 'AMBULATORIO',
      sesionesSemMedico: 1, sesionesSemPsico: 1, sesionesSemGrupal: 0,
      intervenciones: ['medica', 'psicologica'],
      objetivosEspecificos: [{ texto: '' }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'objetivosEspecificos' });

  const mutation = useMutation({
    mutationFn: (d: any) => addictionsApi.createPlan({
      ...d,
      expedienteAdiccionId: id,
      objetivosEspecificos: d.objetivosEspecificos.map((o: any) => o.texto).filter(Boolean),
    }),
    onSuccess: () => router.push(`/adicciones/${id}`),
  });

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link href={`/adicciones/${id}`} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"><ArrowLeft size={16} /></Link>
          <h1 className="text-xl font-bold text-slate-900">Plan de Tratamiento Individual (PTI)</h1>
        </div>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Diagnóstico CIE-10 *</label>
                <input {...register('diagnosticoCie10', { required: true })} placeholder="F10.2"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Modalidad</label>
                <select {...register('modalidad')} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                  {['AMBULATORIO','HOSPITAL_DIA','RESIDENCIAL','GRUPAL'].map(m =>
                    <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Fecha inicio</label>
                <input type="date" {...register('fechaInicio', { required: true })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Fecha revisión</label>
                <input type="date" {...register('fechaRevision', { required: true })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Objetivo general *</label>
              <textarea {...register('objetivoGeneral', { required: true })} rows={2}
                placeholder="Lograr abstinencia total y reinserción social..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-700">Objetivos específicos</label>
                <button type="button" onClick={() => append({ texto: '' })}
                  className="text-xs text-blue-600 flex items-center gap-1"><Plus size={11} /> Agregar</button>
              </div>
              {fields.map((field, i) => (
                <div key={field.id} className="flex gap-2 mb-2">
                  <input {...register(`objetivosEspecificos.${i}.texto`)} placeholder={`Objetivo ${i + 1}...`}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600 p-1"><X size={13} /></button>
                  )}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { name: 'sesionesSemMedico', label: 'Sesiones médico/sem' },
                { name: 'sesionesSemPsico', label: 'Sesiones psico/sem' },
                { name: 'sesionesSemGrupal', label: 'Sesiones grupales/sem' },
              ].map(({ name, label }) => (
                <div key={name}>
                  <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
                  <input type="number" min={0} max={7} {...register(name as any, { valueAsNumber: true })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-center" />
                </div>
              ))}
            </div>
          </div>
          <button type="submit" disabled={mutation.isPending}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50">
            {mutation.isPending ? 'Guardando PTI...' : '✓ Guardar Plan de Tratamiento Individual'}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
