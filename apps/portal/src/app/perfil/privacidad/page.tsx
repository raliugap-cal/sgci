'use client';
// /perfil/privacidad — Información sobre privacidad y derechos ARCO
import { ArrowLeft, Shield, Mail, Phone, FileText } from 'lucide-react';
import Link from 'next/link';

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-100 px-4 py-4 flex items-center gap-3">
        <Link href="/perfil" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="font-bold text-slate-900">Privacidad de mis datos</h1>
      </div>

      <div className="px-4 py-5 max-w-md mx-auto space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={16} className="text-blue-600" />
            <h2 className="font-semibold text-blue-900">Ley Federal de Protección de Datos Personales</h2>
          </div>
          <p className="text-sm text-blue-700">
            Sus datos personales y de salud están protegidos bajo la LFPDPPP.
            Tiene derecho a ejercer sus derechos ARCO en cualquier momento.
          </p>
        </div>

        {[
          {
            title: 'Acceso',
            desc: 'Tiene derecho a saber qué datos personales tenemos sobre usted y cómo los usamos.',
            icon: FileText,
          },
          {
            title: 'Rectificación',
            desc: 'Puede solicitar corregir datos inexactos o incompletos.',
            icon: FileText,
          },
          {
            title: 'Cancelación',
            desc: 'Puede pedir que sus datos sean eliminados, salvo obligación legal de conservarlos.',
            icon: FileText,
          },
          {
            title: 'Oposición',
            desc: 'Puede oponerse al uso de sus datos para finalidades distintas a la atención médica.',
            icon: Shield,
          },
        ].map(({ title, desc, icon: Icon }) => (
          <div key={title} className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14} className="text-slate-400" />
              <h3 className="font-semibold text-slate-900 text-sm">Derecho de {title}</h3>
            </div>
            <p className="text-xs text-slate-500">{desc}</p>
          </div>
        ))}

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
          <h3 className="font-semibold text-slate-900 text-sm">Contacto del responsable de privacidad</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Para ejercer sus derechos ARCO o presentar quejas sobre el manejo de sus datos,
            contáctenos directamente en la clínica o por los siguientes medios:
          </p>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Mail size={11} /> privacidad@clinicasgci.mx
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Phone size={11} /> Recepción de la sede
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Tiempo de respuesta: máximo 20 días hábiles (Art. 22 LFPDPPP)
          </p>
        </div>
      </div>
    </div>
  );
}
