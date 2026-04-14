// ═══════════════════════════════════════════════════════════
// LOAD TEST — k6 · SGCI
// Escenario: 100 citas/día distribuidas
// Prueba endpoints críticos con concurrencia realista
// Ejecutar: k6 run scripts/load-test.js
// ═══════════════════════════════════════════════════════════
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ─── Métricas personalizadas ─────────────────────────────
const loginRate     = new Rate('login_success_rate');
const apiErrors     = new Counter('api_errors');
const loginDuration = new Trend('login_duration', true);
const searchDuration = new Trend('patient_search_duration', true);

// ─── Configuración de escenario ──────────────────────────
export const options = {
  scenarios: {
    // Carga base: personal de recepción buscando pacientes
    recepcion: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5  }, // Ramp up
        { duration: '2m',  target: 10 }, // Carga sostenida (10 usuarios = 3 sedes)
        { duration: '30s', target: 0  }, // Ramp down
      ],
      tags: { role: 'recepcion' },
    },
    // Pico: médicos abriendo consultas simultáneas (cambio de turno)
    medicos_pico: {
      executor: 'constant-vus',
      vus: 15,
      duration: '1m',
      startTime: '1m',
      tags: { role: 'medico' },
    },
    // Portal pacientes: consultas offline sync
    portal_sync: {
      executor: 'constant-arrival-rate',
      rate: 20,        // 20 syncs por segundo
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 10,
      tags: { role: 'portal' },
    },
  },
  thresholds: {
    http_req_duration:       ['p(95)<500', 'p(99)<1000'], // 95% < 500ms
    http_req_failed:         ['rate<0.01'],                // <1% de errores
    login_success_rate:      ['rate>0.99'],                // >99% logins exitosos
    login_duration:          ['p(95)<300'],                // Login < 300ms
    patient_search_duration: ['p(95)<400'],                // Búsqueda < 400ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const SEDE_ID  = __ENV.SEDE_ID  || '00000000-0000-0000-0000-000000000001';

// ─── Función de login ─────────────────────────────────────
function doLogin(email, password) {
  const start = Date.now();
  const res = http.post(`${BASE_URL}/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: { 'Content-Type': 'application/json', 'X-Sede-Id': SEDE_ID },
      tags: { name: 'auth/login' },
    },
  );
  loginDuration.add(Date.now() - start);
  const ok = check(res, {
    'login 200': r => r.status === 200,
    'has accessToken': r => JSON.parse(r.body)?.accessToken !== undefined,
  });
  loginRate.add(ok);
  if (!ok) apiErrors.add(1);
  return ok ? JSON.parse(res.body).accessToken : null;
}

// ─── Escenario principal ──────────────────────────────────
export default function () {
  const role = __ENV.K6_SCENARIO_NAME || 'recepcion';

  if (role === 'portal') {
    portalSyncScenario();
  } else {
    staffScenario(role);
  }
}

function staffScenario(role) {
  // Login
  const email = role === 'medico'
    ? 'dr.rodriguez@clinicasgci.mx'
    : 'superadmin@clinicasgci.mx';

  const token = doLogin(email, role === 'medico' ? 'Medico@2024!' : 'Admin@SGCI2024!');
  if (!token) return;

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Sede-Id': SEDE_ID,
  };

  sleep(0.5);

  // Health check
  group('health', () => {
    const res = http.get(`${BASE_URL}/health`, { headers, tags: { name: 'health' } });
    check(res, { 'health 200': r => r.status === 200 });
  });

  sleep(0.3);

  // Búsqueda de pacientes (acción más frecuente)
  group('patient_search', () => {
    const searches = ['juan', 'mar', 'rod', 'garcia', 'lopez'];
    const q = searches[Math.floor(Math.random() * searches.length)];

    const start = Date.now();
    const res = http.get(`${BASE_URL}/patients?q=${q}&limit=10`, {
      headers, tags: { name: 'patients/search' },
    });
    searchDuration.add(Date.now() - start);

    check(res, {
      'search 200': r => r.status === 200,
      'has data': r => JSON.parse(r.body)?.data !== undefined,
    });
    if (res.status !== 200) apiErrors.add(1);
  });

  sleep(1);

  // Agenda del día
  group('agenda', () => {
    const today = new Date().toISOString().substring(0, 10);
    const res = http.get(`${BASE_URL}/appointments?fecha=${today}&limit=50`, {
      headers, tags: { name: 'appointments/list' },
    });
    check(res, { 'agenda 200': r => r.status === 200 });
    if (res.status !== 200) apiErrors.add(1);
  });

  sleep(0.5);

  // Dashboard admin (solo SUPERADMIN)
  if (role !== 'medico') {
    group('dashboard', () => {
      const from = new Date(Date.now() - 30 * 86400000).toISOString().substring(0, 10);
      const to   = new Date().toISOString().substring(0, 10);
      const res = http.get(`${BASE_URL}/reports/operational?desde=${from}&hasta=${to}`, {
        headers, tags: { name: 'reports/operational' },
      });
      check(res, { 'dashboard 200': r => r.status === 200 });
    });
    sleep(0.3);
  }

  // Búsqueda CIE-10 (médicos)
  if (role === 'medico') {
    group('cie10_search', () => {
      const codes = ['F10', 'F11', 'J06', 'E11', 'I10'];
      const q = codes[Math.floor(Math.random() * codes.length)];
      const res = http.get(`${BASE_URL}/hce/cie10/search?q=${q}`, {
        headers, tags: { name: 'hce/cie10' },
      });
      check(res, { 'cie10 200': r => r.status === 200 });
    });
    sleep(0.5);
  }

  sleep(2);
}

function portalSyncScenario() {
  // Simular sync del portal del paciente (sin autenticación real en load test)
  // En producción usar token real del paciente
  const res = http.get(`${BASE_URL}/health/live`, {
    tags: { name: 'health/live' },
  });
  check(res, { 'health live 200': r => r.status === 200 });
  sleep(3);
}

// ─── Setup inicial ────────────────────────────────────────
export function setup() {
  console.log(`🚀 Load test SGCI iniciado contra: ${BASE_URL}`);
  console.log(`📊 Sede: ${SEDE_ID}`);

  // Verificar que la API esté disponible
  const res = http.get(`${BASE_URL}/health`);
  if (res.status !== 200) {
    throw new Error(`API no disponible: ${res.status}. ¿Está corriendo la API en ${BASE_URL}?`);
  }
  console.log('✅ API disponible');
}

// ─── Teardown ─────────────────────────────────────────────
export function teardown(data) {
  console.log('📈 Load test completado');
}
