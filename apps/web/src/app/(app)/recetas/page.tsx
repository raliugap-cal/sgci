'use client';
// ═══════════════════════════════════════════════════════════
// RECETAS STAFF — /recetas
// Crear receta COFEPRIS · Buscar medicamentos
// Ordinarias / Especiales / Estupefacientes
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Pill, Plus, Search, Trash2, AlertTriangle,
  CheckCircle, Download, ChevronRight, QrCode,
} from 'lucide-react';
import AppShell from '../../../components/AppShell';
import { prescriptionsApi, patientsApi } from '../../../lib/api';
import { clsx } from 'clsx';

const TIPO_RECETA = [
  { value: 'ORDINARIA',     label: 'Ordinaria',      color: 'bg-slate-100 text-slate-700', desc: 'Medicamentos sin restricción especial' },
  { value: 'ESPECIAL',      label: 'Especial',       color: 'bg-blue-100 text-blue-700',   desc: 'Benzodiacepinas y psicotrópicos' },
  { value: 'ESTUPEFACIENTE',label: 'Estupefaciente', color: 'bg-red-100 text-red-700',     desc: 'Opioides y controlados — requiere folio COFEPRIS' },
];

function MedItem({ index, onRemove, form }: { index: number; onRemove: () => void; form: any }) {
  const [busqueda, setBusqueda] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { data: medicamentos } = useQuery({
    queryKey: ['meds-search', busqueda],
    queryFn: async () => {
      const { data } = await prescriptionsApi.searchMeds(busqueda);
      return data;
    },
    enabled: busqueda.length >= 2,
  });

  const alerta = form.watch(`items.${index}.alertaContraindicacion`);

  return (
    <div className={clsx('p-4 rounded-xl border space-y-3', alerta ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50')}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-slate-700">Medicamento {index + 1}</span>
        <div className="flex items-center gap-2">
          {alerta && (
            <span className="text-xs text-red-700 font-medium flex items-center gap-1">
              <AlertTriangle size={11} /> ALERGIA
            </span>
          )}
          <button type="button" onClick={onRemove}
            className="text-red-400 hover:text-red-600 p-1">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Búsqueda de medicamento */}
      <div className="relative">
        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white">
          <Search size={13} className="text-slate-400 shrink-0" />
          <input type="text" placeholder="Buscar por nombre DCI o comercial..."
            value={busqueda} onChange={e => { setBusqueda(e.target.value); setShowSuggestions(true); }}
            className="flex-1 text-sm outline-none" />
        </div>
        {showSuggestions && medicamentos?.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
            {medicamentos.map((m: any) => (
              <button key={m.id} type="button"
                onClick={() => {
                  form.setValue(`items.${index}.medicamentoDci`, m.nombreDci);
                  form.setValue(`items.${index}.medicamentoNombreComercial`, m.nombreComercial ?? '');
                  form.setValue(`items.${index}.medicamentoId`, m.id);
                  form.setValue(`items.${index}.presentacion`, m.presentacion ?? '');
                  form.setValue(`items.${index}.viaAdministracion`, m.viaAdministracion ?? 'Oral');
                  form.setValue(`items.${index}.esControlado`, m.esControlado);
                  setBusqueda(m.nombreDci);
                  setShowSuggestions(false);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-slate-50 last:border-0 text-sm"
              >
                <p className="font-medium text-slate-800">{m.nombreDci}</p>
                <div className="flex gap-2 text-xs text-slate-400">
                  {m.nombreComercial && <span>{m.nombreComercial}</span>}
                  {m.presentacion && <span>· {m.presentacion}</span>}
                  {m.esControlado && <span className="text-amber-600 font-medium">· CONTROLADO</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Campos de la prescripción */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { name: 'dosis', label: 'Dosis', placeholder: 'ej: 10mg' },
          { name: 'frecuencia', label: 'Frecuencia', placeholder: 'ej: cada 8 horas' },
          { name: 'duracionDias', label: 'Días de tratamiento', placeholder: '30', type: 'number' },
          { name: 'cantidadTotal', label: 'Cantidad total', placeholder: '90 tabletas', type: 'number' },
        ].map(({ name, label, placeholder, type }) => (
          <div key={name}>
            <label className="block text-xs text-slate-600 mb-0.5">{label}</label>
            <input type={type ?? 'text'} {...form.register(`items.${index}.${name}`)}
              placeholder={placeholder}
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white" />
          </div>
        ))}
      </div>

      <div>
        <label className="block text-xs text-slate-600 mb-0.5">Indicaciones para el paciente</label>
        <textarea {...form.register(`items.${index}.indicacionesPaciente`)} rows={2}
          placeholder="Ej: Tomar con alimentos, no manejar..."
          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm resize-none bg-white" />
      </div>
    </div>
  );
}

export default function RecetasPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'nueva' | 'historial'>('historial');
  const [pacienteSearch, setPacienteSearch] = useState('');
  const [selectedPaciente, setSelectedPaciente] = useState<any>(null);
  const [tipoReceta, setTipoReceta] = useState('ORDINARIA');
  const [newReceta, setNewReceta] = useState<any>(null);

  const form = useForm({ defaultValues: { items: [{}] } });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });

  const { data: pacientes } = useQuery({
    queryKey: ['search-pac-rx', pacienteSearch],
    queryFn: async () => {
      const { data } = await patientsApi.search({ q: pacienteSearch, limit: 6 });
      return data?.data;
    },
    enabled: pacienteSearch.length >= 2,
  });

  const { data: historial } = useQuery({
    queryKey: ['recetas-paciente', selectedPaciente?.id],
    queryFn: async () => {
      const { data } = await prescriptionsApi.findByPaciente(selectedPaciente.id);
      return data;
    },
    enabled: !!selectedPaciente?.id && tab === 'historial',
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => prescriptionsApi.create({
      ...d,
      pacienteId: selectedPaciente?.id,
      tipoReceta,
    }),
    onSuccess: (res) => {
      setNewReceta(res.data);
      qc.invalidateQueries({ queryKey: ['recetas-paciente'] });
      form.reset({ items: [{}] });
    },
  });

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Recetas</h1>
            <p className="text-slate-500 text-sm">COFEPRIS · Ordinarias · Especiales · Estupefacientes</p>
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {(['historial', 'nueva'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={clsx('px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors',
                  tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}>
                {t === 'nueva' ? '+ Nueva receta' : 'Historial'}
              </button>
            ))}
          </div>
        </div>

        {/* Buscar paciente */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input type="text" placeholder="Buscar paciente por nombre o expediente..."
              value={pacienteSearch} onChange={e => setPacienteSearch(e.target.value)}
              className="flex-1 text-sm outline-none" />
          </div>

          {pacientes?.length > 0 && !selectedPaciente && (
            <div className="mt-2 space-y-1">
              {pacientes.map((p: any) => (
                <button key={p.id} onClick={() => { setSelectedPaciente(p); setPacienteSearch(''); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 text-left">
                  <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">
                    {p.nombre[0]}{p.apellidoPaterno[0]}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-900">{p.apellidoPaterno} {p.nombre}</span>
                    <span className="text-xs text-slate-500 ml-2">{p.numeroExpediente}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedPaciente && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1 bg-blue-50 rounded-lg px-3 py-2">
                <User size={13} className="text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  {selectedPaciente.apellidoPaterno} {selectedPaciente.nombre}
                </span>
                <span className="text-xs text-blue-500">{selectedPaciente.numeroExpediente}</span>
              </div>
              <button onClick={() => setSelectedPaciente(null)} className="text-slate-400 hover:text-slate-600 text-xs">
                Cambiar
              </button>
            </div>
          )}
        </div>

        {/* Éxito */}
        {newReceta && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle size={18} className="text-emerald-600" />
              <div>
                <p className="font-semibold text-emerald-800">Receta creada: {newReceta.numeroReceta}</p>
                {newReceta.alertas?.length > 0 && (
                  <p className="text-xs text-red-700 flex items-center gap-1 mt-0.5">
                    <AlertTriangle size={10} /> {newReceta.alertas.length} alerta(s) de contraindicación
                  </p>
                )}
              </div>
            </div>
            {newReceta.pdfUrl && (
              <a href={newReceta.pdfUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs">
                <Download size={12} /> Descargar PDF
              </a>
            )}
          </div>
        )}

        {/* Tab: Nueva receta */}
        {tab === 'nueva' && selectedPaciente && (
          <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            {/* Tipo de receta */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <label className="block text-sm font-semibold text-slate-900 mb-3">Tipo de receta</label>
              <div className="grid grid-cols-3 gap-2">
                {TIPO_RECETA.map(({ value, label, color, desc }) => (
                  <button type="button" key={value} onClick={() => setTipoReceta(value)}
                    className={clsx('p-3 rounded-xl border-2 text-left transition-all',
                      tipoReceta === value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300')}>
                    <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-medium', color)}>{label}</span>
                    <p className="text-xs text-slate-500 mt-1">{desc}</p>
                  </button>
                ))}
              </div>
              {tipoReceta === 'ESTUPEFACIENTE' && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertTriangle size={12} className="inline mr-1" />
                  Se consumirá un folio COFEPRIS del médico automáticamente.
                  Verifique que el médico esté habilitado y tenga folios disponibles.
                </div>
              )}
            </div>

            {/* Medicamentos */}
            <div className="space-y-3">
              {fields.map((field, index) => (
                <MedItem key={field.id} index={index} form={form} onRemove={() => remove(index)} />
              ))}
              <button type="button" onClick={() => append({})}
                className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-colors flex items-center justify-center gap-2">
                <Plus size={14} /> Agregar otro medicamento
              </button>
            </div>

            <button type="submit" disabled={createMutation.isPending || !selectedPaciente}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
              {createMutation.isPending ? 'Generando receta...' : '✓ Generar receta COFEPRIS'}
            </button>
          </form>
        )}

        {!selectedPaciente && tab === 'nueva' && (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
            <Pill size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Seleccione un paciente para crear una receta</p>
          </div>
        )}

        {/* Tab: Historial */}
        {tab === 'historial' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {!selectedPaciente ? (
              <div className="p-10 text-center text-slate-400">
                <Pill size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Seleccione un paciente para ver su historial de recetas</p>
              </div>
            ) : !historial?.data?.length ? (
              <div className="p-8 text-center text-slate-400">
                <Pill size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sin recetas para este paciente</p>
              </div>
            ) : (
              historial.data.map((r: any) => (
                <div key={r.id} className="p-4 border-b border-slate-50 last:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-mono text-slate-600">{r.numeroReceta}</span>
                        <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-medium',
                          TIPO_RECETA.find(t => t.value === r.tipoReceta)?.color ?? 'bg-slate-100 text-slate-600')}>
                          {TIPO_RECETA.find(t => t.value === r.tipoReceta)?.label}
                        </span>
                        <span className={clsx('text-xs px-1.5 py-0.5 rounded-full',
                          r.estado === 'ACTIVA' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500')}>
                          {r.estado}
                        </span>
                        {r.folioCofepris && (
                          <span className="text-xs text-red-600 font-mono">{r.folioCofepris}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        {format(new Date(r.createdAt), "d 'de' MMMM 'de' yyyy", { locale: es })}
                        {' · Dr(a). '}{r.medico?.usuario?.nombre} {r.medico?.usuario?.apellidoPaterno}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {r.items?.map((item: any, i: number) => (
                          <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {item.medicamentoDci} {item.dosis}
                          </span>
                        ))}
                      </div>
                    </div>
                    {r.pdfUrl && (
                      <a href={r.pdfUrl} target="_blank" rel="noreferrer"
                        className="shrink-0 p-2 text-slate-400 hover:text-slate-600">
                        <Download size={14} />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

// Componente User faltante
function User({ size, className }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
