'use client';
// ═══════════════════════════════════════════════════════════
// NUEVO PACIENTE — /pacientes/nuevo
// NOM-004 + LFPDPPP · Validación CURP · Consentimiento
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, User, Shield, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import AppShell from '../../../../components/AppShell';
import { patientsApi } from '../../../../lib/api';
import { clsx } from 'clsx';

const CURP_REGEX = /^[A-Z]{1}[AEIOU]{1}[A-Z]{2}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[HM]{1}(AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]{1}[0-9]{1}$/;

const schema = z.object({
  nombre:            z.string().min(2, 'Requerido'),
  apellidoPaterno:   z.string().min(2, 'Requerido'),
  apellidoMaterno:   z.string().optional(),
  fechaNacimiento:   z.string().min(1, 'Requerido'),
  sexo:              z.enum(['MASCULINO', 'FEMENINO', 'INTERSEX']),
  generoIdentidad:   z.string().optional(),
  curp:              z.string().optional().refine(v => !v || CURP_REGEX.test(v.toUpperCase()), { message: 'CURP inválida' }),
  rfc:               z.string().optional(),
  regimenFiscal:     z.string().optional(),
  usoCfdi:           z.string().optional(),
  email:             z.string().email('Email inválido').optional().or(z.literal('')),
  telefono:          z.string().optional(),
  whatsapp:          z.string().optional(),
  estadoCivil:       z.string().optional(),
  ocupacion:         z.string().optional(),
  escolaridad:       z.string().optional(),
  grupoSanguineo:    z.string().optional(),
  consentimientoLFPDPPP: z.boolean().refine(v => v === true, 'El consentimiento de privacidad es obligatorio'),
});

type Form = z.infer<typeof schema>;

const CAMPOS_REQUERIDOS = [
  { name: 'nombre', label: 'Nombre(s)', placeholder: 'Juan', col: 1 },
  { name: 'apellidoPaterno', label: 'Apellido paterno', placeholder: 'Pérez', col: 1 },
  { name: 'apellidoMaterno', label: 'Apellido materno', placeholder: 'González', col: 1 },
];

export default function NuevoPacientePage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { sexo: 'MASCULINO', grupoSanguineo: 'DESCONOCIDO' },
  });

  const createMutation = useMutation({
    mutationFn: (d: Form) => patientsApi.create(d),
    onSuccess: (res) => router.push(`/pacientes/${res.data.id}`),
  });

  const stepsLabels = ['Datos personales', 'Contacto y fiscal', 'Consentimientos'];

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/pacientes" className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500">
            <ArrowLeft size={16} />
          </Link>
          <h1 className="text-xl font-bold text-slate-900">Nuevo paciente</h1>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2">
          {stepsLabels.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                step > i + 1 ? 'bg-emerald-500 text-white' :
                step === i + 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500')}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={clsx('text-xs hidden sm:block', step === i + 1 ? 'font-medium text-slate-900' : 'text-slate-400')}>{s}</span>
              {i < stepsLabels.length - 1 && <div className="flex-1 h-px bg-slate-200" />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit(d => createMutation.mutate(d))}>

          {/* Step 1: Datos personales */}
          {step === 1 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-2">
                <User size={14} className="text-slate-400" /> Datos personales — NOM-004
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {['nombre', 'apellidoPaterno', 'apellidoMaterno'].map(field => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-slate-700 mb-1 capitalize">
                      {field.replace(/([A-Z])/g, ' $1').toLowerCase()}
                      {field !== 'apellidoMaterno' && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <input {...register(field as any)} placeholder=""
                      className={clsx('w-full px-3 py-2 border rounded-lg text-sm',
                        errors[field as keyof Form] ? 'border-red-300 bg-red-50' : 'border-slate-200')} />
                    {errors[field as keyof Form] && (
                      <p className="text-red-600 text-xs mt-0.5">{errors[field as keyof Form]?.message}</p>
                    )}
                  </div>
                ))}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Fecha de nacimiento *</label>
                  <input type="date" {...register('fechaNacimiento')}
                    className={clsx('w-full px-3 py-2 border rounded-lg text-sm',
                      errors.fechaNacimiento ? 'border-red-300' : 'border-slate-200')} />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Sexo biológico *</label>
                  <select {...register('sexo')} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                    <option value="MASCULINO">Masculino</option>
                    <option value="FEMENINO">Femenino</option>
                    <option value="INTERSEX">Intersex</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Identidad de género (opcional)</label>
                  <input {...register('generoIdentidad')} placeholder="Si difiere del sexo biológico"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">CURP</label>
                  <input {...register('curp')} placeholder="ABCD123456HXXXXX00"
                    className={clsx('w-full px-3 py-2 border rounded-lg text-sm font-mono uppercase',
                      errors.curp ? 'border-red-300 bg-red-50' : 'border-slate-200')} />
                  {errors.curp && <p className="text-red-600 text-xs mt-0.5">{errors.curp.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Grupo sanguíneo</label>
                  <select {...register('grupoSanguineo')} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                    {['DESCONOCIDO','A_POSITIVO','A_NEGATIVO','B_POSITIVO','B_NEGATIVO','AB_POSITIVO','AB_NEGATIVO','O_POSITIVO','O_NEGATIVO'].map(g => (
                      <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Estado civil</label>
                  <select {...register('estadoCivil')} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                    <option value="">No especificado</option>
                    {['Soltero/a','Casado/a','Divorciado/a','Viudo/a','Unión libre'].map(e => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Ocupación</label>
                  <input {...register('ocupacion')} placeholder="Ej: Empleado, estudiante..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Escolaridad</label>
                  <select {...register('escolaridad')} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                    <option value="">No especificado</option>
                    {['Sin escolaridad','Primaria','Secundaria','Preparatoria','Técnico','Licenciatura','Posgrado'].map(e => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="button" onClick={() => setStep(2)}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 mt-4">
                Continuar →
              </button>
            </div>
          )}

          {/* Step 2: Contacto y datos fiscales */}
          {step === 2 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">Contacto y datos fiscales</span>
                <button type="button" onClick={() => setStep(1)} className="text-xs text-blue-600">← Atrás</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { name: 'email',    label: 'Correo electrónico',  type: 'email',  placeholder: 'paciente@email.com' },
                  { name: 'telefono', label: 'Teléfono',            type: 'tel',    placeholder: '8112345678' },
                  { name: 'whatsapp', label: 'WhatsApp',            type: 'tel',    placeholder: '8112345678' },
                  { name: 'rfc',      label: 'RFC',                 type: 'text',   placeholder: 'XXXX123456XXX' },
                ].map(({ name, label, type, placeholder }) => (
                  <div key={name}>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
                    <input type={type} {...register(name as any)} placeholder={placeholder}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    {errors[name as keyof Form] && (
                      <p className="text-red-600 text-xs mt-0.5">{String(errors[name as keyof Form]?.message)}</p>
                    )}
                  </div>
                ))}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Régimen fiscal</label>
                  <select {...register('regimenFiscal')} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                    <option value="">No requiere CFDI</option>
                    <option value="612">612 — Personas Físicas con Actividad Empresarial</option>
                    <option value="605">605 — Sueldos y Salarios</option>
                    <option value="616">616 — Sin obligaciones fiscales (XAXX)</option>
                    <option value="626">626 — Régimen Simplificado de Confianza (RESICO)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Uso de CFDI</label>
                  <select {...register('usoCfdi')} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                    <option value="G03">G03 — Gastos en general</option>
                    <option value="D01">D01 — Honorarios médicos y dentales</option>
                    <option value="D07">D07 — Primas por seguros de gastos médicos</option>
                    <option value="S01">S01 — Sin efectos fiscales</option>
                  </select>
                </div>
              </div>

              <button type="button" onClick={() => setStep(3)}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium mt-4">
                Continuar →
              </button>
            </div>
          )}

          {/* Step 3: Consentimientos */}
          {step === 3 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Shield size={14} className="text-slate-400" /> Consentimientos — LFPDPPP
                </span>
                <button type="button" onClick={() => setStep(2)} className="text-xs text-blue-600">← Atrás</button>
              </div>

              {/* Aviso de privacidad */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 max-h-48 overflow-y-auto leading-relaxed">
                <p className="font-semibold text-slate-900 mb-2">AVISO DE PRIVACIDAD SIMPLIFICADO</p>
                <p>
                  De conformidad con la <strong>Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)</strong>,
                  le informamos que <strong>Clínica SGCI</strong> es responsable del tratamiento de sus datos personales.
                </p>
                <p className="mt-2">
                  <strong>Datos recabados:</strong> Nombre, fecha de nacimiento, CURP, RFC, datos de contacto,
                  historial clínico, diagnósticos y tratamientos médicos.
                </p>
                <p className="mt-2">
                  <strong>Finalidades primarias:</strong> Prestación de servicios de salud, expediente clínico (NOM-004-SSA3),
                  emisión de recetas y comprobantes fiscales.
                </p>
                <p className="mt-2">
                  <strong>Derechos ARCO:</strong> Tiene derecho de Acceso, Rectificación, Cancelación y Oposición al
                  tratamiento de sus datos. Para ejercerlos, contacte a nuestro responsable de privacidad.
                </p>
                <p className="mt-2">
                  Sus datos de salud son datos sensibles y reciben protección reforzada conforme al Art. 9 de la LFPDPPP.
                  No serán vendidos, cedidos ni transferidos a terceros sin su consentimiento expreso, salvo
                  obligación legal.
                </p>
              </div>

              <label className={clsx(
                'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors',
                watch('consentimientoLFPDPPP') ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300',
              )}>
                <input type="checkbox" {...register('consentimientoLFPDPPP')}
                  className="mt-0.5 w-4 h-4 accent-blue-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Acepto el Aviso de Privacidad y consiento el tratamiento de mis datos personales
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    LFPDPPP · Tratamiento necesario para la prestación del servicio de salud
                  </p>
                </div>
              </label>
              {errors.consentimientoLFPDPPP && (
                <p className="text-red-600 text-xs flex items-center gap-1">
                  <AlertTriangle size={12} /> {errors.consentimientoLFPDPPP.message}
                </p>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                <p className="font-medium mb-1">Nota legal</p>
                <p>
                  El consentimiento quedará registrado con fecha, hora e IP del sistema.
                  El paciente puede revocar o modificar su consentimiento en cualquier momento
                  ejerciendo sus derechos ARCO.
                </p>
              </div>

              <button type="submit" disabled={createMutation.isPending}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {createMutation.isPending ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Registrando...</>
                ) : (
                  <><CheckCircle size={16} /> Registrar paciente</>
                )}
              </button>

              {createMutation.isError && (
                <p className="text-red-600 text-sm text-center">
                  {(createMutation.error as any)?.response?.data?.message ?? 'Error al registrar. Intente nuevamente.'}
                </p>
              )}
            </div>
          )}
        </form>
      </div>
    </AppShell>
  );
}
