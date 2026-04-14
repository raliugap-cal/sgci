'use client';
// /adicciones/[id]/nueva-sesion — Nota de sesión NOM-028
import { useParams, useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import AppShell from '../../../../../components/AppShell';
import { addictionsApi } from '../../../../../lib/api';

export default function NuevaSesionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: { tipoSesion: 'individual', huboConsumo: false },
  });

  const huboConsumo = watch('huboConsumo');

  const mutation = useMutation({
    mutationFn: (d: any) => addictionsApi.createSession({ ...d, expedienteAdiccionId: id }),
    onSuccess: () => router.push(`/adicciones/${id}?tab=sesiones`),
  });

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link href={`/adicciones/${id}`} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500">
            <ArrowLeft size={16} />
          </Link>
          <h1 className="text-xl font-bold text-slate-900">Nueva nota de sesión</h1>
        </div>

        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">

            {/* Tipo y datos básicos */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tipo de sesión *</label>
                <select {...register('tipoSesion', { required: true })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                  <option value="individual">Individual</option>
                  <option value="grupal">Grupal</option>
                  <option value="familiar">Familiar</option>
                  <option value="pareja">Pareja</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">¿Hubo consumo reportado?</label>
                <select {...register('huboConsumo')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                  <option value="">No reportado / Sin información</option>
                  <option value="false">No hubo consumo</option>
                  <option value="true">Sí hubo consumo</option>
                </select>
              </div>
            </div>

            {/* Sustancias si hubo consumo */}
            {String(huboConsumo) === 'true' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <label className="block text-xs font-medium text-red-700 mb-1">Sustancias consumidas</label>
                <input {...register('sustanciasConsumo')}
                  placeholder="Ej: alcohol, marihuana (separar con coma)"
                  className="w-full px-3 py-2 border border-red-200 bg-white rounded-lg text-sm" />
              </div>
            )}

            {/* Objetivos */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Objetivos de la sesión *</label>
              <input {...register('objetivosSesion', { required: 'Requerido' })}
                placeholder="Ej: Revisar estrategias de afrontamiento, trabajar duelo..."
                className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.objetivosSesion ? 'border-red-300' : 'border-slate-200'}`} />
              {errors.objetivosSesion && <p className="text-red-600 text-xs mt-0.5">{errors.objetivosSesion.message}</p>}
            </div>

            {/* Contenido de la sesión */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Desarrollo de la sesión *</label>
              <textarea {...register('contenido', { required: 'Requerido', minLength: { value: 20, message: 'Mínimo 20 caracteres' } })}
                rows={6}
                placeholder="Descripción detallada del desarrollo de la sesión, temas abordados, respuestas del paciente, observaciones clínicas..."
                className={`w-full px-3 py-2 border rounded-lg text-sm resize-none ${errors.contenido ? 'border-red-300' : 'border-slate-200'}`} />
              {errors.contenido && <p className="text-red-600 text-xs mt-0.5">{errors.contenido.message}</p>}
            </div>

            {/* Logros y tareas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Logros observados</label>
                <textarea {...register('logros')} rows={3}
                  placeholder="Avances, cambios positivos, habilidades desarrolladas..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tareas y compromisos</label>
                <textarea {...register('tareas')} rows={3}
                  placeholder="Actividades para casa, compromisos del paciente..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" />
              </div>
            </div>

            {/* Próxima sesión */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Plan para próxima sesión</label>
              <textarea {...register('proximaSesion')} rows={2}
                placeholder="Temas a abordar en la siguiente sesión..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" />
            </div>
          </div>

          <button type="submit" disabled={mutation.isPending}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {mutation.isPending ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</>
            ) : (
              <><CheckCircle size={16} /> Guardar nota de sesión</>
            )}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
