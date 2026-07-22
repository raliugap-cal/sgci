// ═══════════════════════════════════════════════════════════
// SEED DE MEDICAMENTOS — Catálogo básico COFEPRIS México
// Correr con: npx ts-node src/database/seed-medicamentos.ts
// ═══════════════════════════════════════════════════════════
import { PrismaClient, TipoReceta } from '@prisma/client';

const prisma = new PrismaClient();

const medicamentos = [
  // ─── Analgésicos / Antipiréticos ──────────────────────
  { claveCofepris: 'PARA500C', nombreDci: 'Paracetamol', nombreComercial: 'Tempra / Tylenol', presentacion: '500mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Analgésico', esControlado: false, tipoReceta: TipoReceta.ORDINARIA, dosisMaximaDiaria: '4000mg' },
  { claveCofepris: 'PARA125S', nombreDci: 'Paracetamol', nombreComercial: 'Tempra infantil', presentacion: '125mg/5ml jarabe', viaAdministracion: 'Oral', grupoTerapeutico: 'Analgésico', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'IBUP400T', nombreDci: 'Ibuprofeno', nombreComercial: 'Advil / Motrin', presentacion: '400mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'AINE', esControlado: false, tipoReceta: TipoReceta.ORDINARIA, dosisMaximaDiaria: '2400mg' },
  { claveCofepris: 'IBUP600T', nombreDci: 'Ibuprofeno', nombreComercial: 'Motrin IB', presentacion: '600mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'AINE', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'NAPRO550', nombreDci: 'Naproxeno', nombreComercial: 'Naprosyn', presentacion: '550mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'AINE', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'DICLF50T', nombreDci: 'Diclofenaco', nombreComercial: 'Voltaren', presentacion: '50mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'AINE', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'DICLF75I', nombreDci: 'Diclofenaco', nombreComercial: 'Voltaren inyectable', presentacion: '75mg/3ml ampolleta', viaAdministracion: 'Intramuscular', grupoTerapeutico: 'AINE', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'KETO30IT', nombreDci: 'Ketorolaco', nombreComercial: 'Dolac', presentacion: '30mg/ml ampolleta', viaAdministracion: 'Intramuscular', grupoTerapeutico: 'AINE', esControlado: false, tipoReceta: TipoReceta.ORDINARIA, dosisMaximaDiaria: '120mg' },
  { claveCofepris: 'METM500T', nombreDci: 'Metamizol (Dipirona)', nombreComercial: 'Nolotil', presentacion: '500mg cápsula', viaAdministracion: 'Oral', grupoTerapeutico: 'Analgésico', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  // ─── Antibióticos ─────────────────────────────────────
  { claveCofepris: 'AMOX500C', nombreDci: 'Amoxicilina', nombreComercial: 'Amoxil', presentacion: '500mg cápsula', viaAdministracion: 'Oral', grupoTerapeutico: 'Antibiótico betalactámico', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'AMOX875T', nombreDci: 'Amoxicilina/Ácido clavulánico', nombreComercial: 'Augmentin', presentacion: '875/125mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Antibiótico betalactámico', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'AZIT500T', nombreDci: 'Azitromicina', nombreComercial: 'Zithromax', presentacion: '500mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Antibiótico macrólido', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'CLARI500', nombreDci: 'Claritromicina', nombreComercial: 'Klaricid', presentacion: '500mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Antibiótico macrólido', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'CIPRO500', nombreDci: 'Ciprofloxacino', nombreComercial: 'Ciproxina', presentacion: '500mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Antibiótico quinolona', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'LEVO500T', nombreDci: 'Levofloxacino', nombreComercial: 'Levaquin', presentacion: '500mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Antibiótico quinolona', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'TRIM160T', nombreDci: 'Trimetoprim/Sulfametoxazol', nombreComercial: 'Bactrim', presentacion: '160/800mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Antibiótico sulfonamida', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'DOXY100C', nombreDci: 'Doxiciclina', nombreComercial: 'Vibramycin', presentacion: '100mg cápsula', viaAdministracion: 'Oral', grupoTerapeutico: 'Antibiótico tetraciclina', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'METR500T', nombreDci: 'Metronidazol', nombreComercial: 'Flagyl', presentacion: '500mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Antibiótico/Antiparasitario', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  // ─── Antihipertensivos ────────────────────────────────
  { claveCofepris: 'LOSI50TH', nombreDci: 'Losartán', nombreComercial: 'Cozaar', presentacion: '50mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'ARA II', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'ENALA10T', nombreDci: 'Enalapril', nombreComercial: 'Renitec', presentacion: '10mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'IECA', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'AMLO5TH', nombreDci: 'Amlodipino', nombreComercial: 'Norvasc', presentacion: '5mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Bloqueador de calcio', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'METOP50T', nombreDci: 'Metoprolol', nombreComercial: 'Lopressor', presentacion: '50mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Betabloqueador', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'HIDRO25T', nombreDci: 'Hidroclorotiazida', nombreComercial: 'Microzide', presentacion: '25mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Diurético tiazídico', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  // ─── Diabetes ─────────────────────────────────────────
  { claveCofepris: 'METF500T', nombreDci: 'Metformina', nombreComercial: 'Glucophage', presentacion: '500mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Antidiabético biguanida', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'METF850T', nombreDci: 'Metformina', nombreComercial: 'Glucophage XR', presentacion: '850mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Antidiabético biguanida', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'GLIBN5TH', nombreDci: 'Glibenclamida', nombreComercial: 'Daonil', presentacion: '5mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Antidiabético sulfonilurea', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'INSUL10U', nombreDci: 'Insulina glargina', nombreComercial: 'Lantus', presentacion: '100U/ml pluma', viaAdministracion: 'Subcutánea', grupoTerapeutico: 'Insulina basal', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  // ─── Colesterol ───────────────────────────────────────
  { claveCofepris: 'ATOR20TH', nombreDci: 'Atorvastatina', nombreComercial: 'Lipitor', presentacion: '20mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Estatina', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'ATOR40TH', nombreDci: 'Atorvastatina', nombreComercial: 'Lipitor', presentacion: '40mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Estatina', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'ROSU10TH', nombreDci: 'Rosuvastatina', nombreComercial: 'Crestor', presentacion: '10mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Estatina', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  // ─── Gastroenterología ────────────────────────────────
  { claveCofepris: 'OMEP20TC', nombreDci: 'Omeprazol', nombreComercial: 'Prilosec', presentacion: '20mg cápsula', viaAdministracion: 'Oral', grupoTerapeutico: 'IBP', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'OMEP40TC', nombreDci: 'Omeprazol', nombreComercial: 'Losec', presentacion: '40mg cápsula', viaAdministracion: 'Oral', grupoTerapeutico: 'IBP', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'PANT40TH', nombreDci: 'Pantoprazol', nombreComercial: 'Protonix', presentacion: '40mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'IBP', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'RANI150T', nombreDci: 'Ranitidina', nombreComercial: 'Zantac', presentacion: '150mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Anti-H2', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'METO10TH', nombreDci: 'Metoclopramida', nombreComercial: 'Plasil', presentacion: '10mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Procinético', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  // ─── Salud mental / Adicciones ────────────────────────
  { claveCofepris: 'SERT50TH', nombreDci: 'Sertralina', nombreComercial: 'Zoloft', presentacion: '50mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'ISRS antidepresivo', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'FLUO20TC', nombreDci: 'Fluoxetina', nombreComercial: 'Prozac', presentacion: '20mg cápsula', viaAdministracion: 'Oral', grupoTerapeutico: 'ISRS antidepresivo', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'ESCIT10T', nombreDci: 'Escitalopram', nombreComercial: 'Lexapro', presentacion: '10mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'ISRS antidepresivo', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'VENL75TC', nombreDci: 'Venlafaxina', nombreComercial: 'Effexor', presentacion: '75mg cápsula', viaAdministracion: 'Oral', grupoTerapeutico: 'IRSN antidepresivo', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'NALTR50T', nombreDci: 'Naltrexona', nombreComercial: 'Revia', presentacion: '50mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Antagonista opioide - adicciones', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'BUPRO300', nombreDci: 'Bupropión', nombreComercial: 'Wellbutrin', presentacion: '300mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Antidepresivo - cesación tabaco', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'DIAZU5TH', nombreDci: 'Diazepam', nombreComercial: 'Valium', presentacion: '5mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Benzodiacepina ansiolítica', esControlado: true, tipoReceta: TipoReceta.ESPECIAL, contraindicaciones: ['Miastenia gravis', 'Glaucoma', 'Embarazo'] },
  { claveCofepris: 'LORAZU2T', nombreDci: 'Lorazepam', nombreComercial: 'Ativan', presentacion: '2mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Benzodiacepina ansiolítica', esControlado: true, tipoReceta: TipoReceta.ESPECIAL },
  { claveCofepris: 'CLONA2TH', nombreDci: 'Clonazepam', nombreComercial: 'Klonopin / Rivotril', presentacion: '2mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Benzodiacepina anticonvulsiva', esControlado: true, tipoReceta: TipoReceta.ESPECIAL },
  { claveCofepris: 'QUETI25T', nombreDci: 'Quetiapina', nombreComercial: 'Seroquel', presentacion: '25mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Antipsicótico atípico', esControlado: false, tipoReceta: TipoReceta.ESPECIAL },
  { claveCofepris: 'RISPE2TH', nombreDci: 'Risperidona', nombreComercial: 'Risperdal', presentacion: '2mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Antipsicótico atípico', esControlado: false, tipoReceta: TipoReceta.ESPECIAL },
  // ─── Vitaminas y suplementos ──────────────────────────
  { claveCofepris: 'ACID5TH', nombreDci: 'Ácido fólico', nombreComercial: 'Folicil', presentacion: '5mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Vitamina', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'VITA50UI', nombreDci: 'Vitamina D3', nombreComercial: 'Vigantol', presentacion: '50,000UI cápsula', viaAdministracion: 'Oral', grupoTerapeutico: 'Vitamina', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'CALC500T', nombreDci: 'Calcio + Vitamina D', nombreComercial: 'Caltrate', presentacion: '500mg/200UI tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Suplemento', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  // ─── Respiratorio ─────────────────────────────────────
  { claveCofepris: 'SALMBU10', nombreDci: 'Salbutamol', nombreComercial: 'Ventolin', presentacion: '100mcg/dosis inhalador', viaAdministracion: 'Inhalatoria', grupoTerapeutico: 'Broncodilatador beta-2', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'PRED20TH', nombreDci: 'Prednisona', nombreComercial: 'Deltasone', presentacion: '20mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Corticosteroide sistémico', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'DEXAM4TH', nombreDci: 'Dexametasona', nombreComercial: 'Decadron', presentacion: '4mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Corticosteroide sistémico', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'LORTA10T', nombreDci: 'Loratadina', nombreComercial: 'Claritin', presentacion: '10mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Antihistamínico', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
  { claveCofepris: 'CETIRIZ10', nombreDci: 'Cetirizina', nombreComercial: 'Zyrtec', presentacion: '10mg tableta', viaAdministracion: 'Oral', grupoTerapeutico: 'Antihistamínico', esControlado: false, tipoReceta: TipoReceta.ORDINARIA },
];

async function main() {
  console.log('💊 Cargando catálogo de medicamentos...');

  let creados = 0;
  let omitidos = 0;

  for (const med of medicamentos) {
    try {
      await prisma.medicamento.upsert({
        where: { claveCofepris: med.claveCofepris },
        update: {},
        create: {
          ...med,
          contraindicaciones: med.contraindicaciones ?? [],
          activo: true,
        },
      });
      creados++;
    } catch (e: any) {
      console.log(`  ⚠️  ${med.nombreDci} (${med.claveCofepris}): ${e.message}`);
      omitidos++;
    }
  }

  console.log(`✅ ${creados} medicamentos cargados, ${omitidos} omitidos`);
  console.log('\n💡 Para buscar medicamentos en la API:');
  console.log('   GET /api/v1/prescriptions/medications/search?q=paracetamol');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
