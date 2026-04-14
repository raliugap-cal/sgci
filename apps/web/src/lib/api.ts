// ═══════════════════════════════════════════════════════════
// API CLIENT — Axios con interceptores JWT y sede
// ═══════════════════════════════════════════════════════════
import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function createApiClient(getToken: () => string | null, getSedeId: () => string | null): AxiosInstance {
  const client = axios.create({
    baseURL: `${API_BASE}/api/v1`,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
  });

  // Request: inyectar token y sede
  client.interceptors.request.use((config) => {
    const token = getToken();
    const sedeId = getSedeId();
    if (token) config.headers['Authorization'] = `Bearer ${token}`;
    if (sedeId) config.headers['X-Sede-Id'] = sedeId;
    return config;
  });

  // Response: manejar 401 y refrescar token
  client.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
      if (error.response?.status === 401) {
        // Intentar refresh
        const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
        if (refreshToken) {
          try {
            const { data } = await axios.post(`${API_BASE}/api/v1/auth/refresh`, { refreshToken });
            localStorage.setItem('accessToken', data.accessToken);
            // Reintentar la request original
            if (error.config) {
              error.config.headers['Authorization'] = `Bearer ${data.accessToken}`;
              return axios(error.config);
            }
          } catch {
            localStorage.clear();
            window.location.href = '/login';
          }
        } else {
          if (typeof window !== 'undefined') window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    },
  );

  return client;
}

// Instancia global del cliente API
export const api = createApiClient(
  () => (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null),
  () => (typeof window !== 'undefined' ? localStorage.getItem('sedeId') : null),
);

// ─── Servicios organizados por dominio ───────────────────
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  verifyMfa: (mfaToken: string, code: string) => api.post('/auth/verify-mfa', { mfaToken, code }),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  me: () => api.get('/auth/me'),
};

export const patientsApi = {
  search: (params: Record<string, any>) => api.get('/patients', { params }),
  findById: (id: string) => api.get(`/patients/${id}`),
  create: (data: Record<string, any>) => api.post('/patients', data),
  update: (id: string, data: Record<string, any>) => api.patch(`/patients/${id}`, data),
  clinicalSummary: (id: string) => api.get(`/patients/${id}/clinical-summary`),
  timeline: (id: string, page = 1) => api.get(`/patients/${id}/timeline`, { params: { page } }),
  activatePortal: (id: string, email: string) => api.post(`/patients/${id}/activate-portal`, { email }),
  getArco: (id: string) => api.get(`/patients/${id}/arco`),
  signConsent: (id: string, tipo: string, body: Record<string, any>) =>
    api.post(`/patients/${id}/consents/${tipo}/sign`, body),
};

export const appointmentsApi = {
  getAvailability: (params: Record<string, any>) => api.get('/appointments/availability', { params }),
  create: (data: Record<string, any>) => api.post('/appointments', data),
  findAll: (params: Record<string, any>) => api.get('/appointments', { params }),
  findById: (id: string) => api.get(`/appointments/${id}`),
  update: (id: string, data: Record<string, any>) => api.patch(`/appointments/${id}`, data),
  checkIn: (id: string, data?: Record<string, any>) => api.post(`/appointments/${id}/checkin`, data ?? {}),
  cancel: (id: string, motivo: string) => api.post(`/appointments/${id}/cancel`, { motivo }),
  getTelehealthToken: (id: string) => api.get(`/appointments/${id}/telehealth-token`),
};

export const hceApi = {
  openConsulta: (citaId: string) => api.post('/hce/consultas', { citaId }),
  closeConsulta: (id: string) => api.post(`/hce/consultas/${id}/close`),
  createNota: (data: Record<string, any>) => api.post('/hce/notas', data),
  updateNota: (id: string, data: Record<string, any>) => api.patch(`/hce/notas/${id}`, data),
  signNota: (id: string) => api.post(`/hce/notas/${id}/sign`),
  upsertVitals: (data: Record<string, any>) => api.post('/hce/vitals', data),
  addDiagnosis: (data: Record<string, any>) => api.post('/hce/diagnoses', data),
  searchCie10: (q: string) => api.get('/hce/cie10/search', { params: { q } }),
  getTemplates: (especialidadId?: string) => api.get('/hce/templates', { params: { especialidadId } }),
};

export const labApi = {
  createOrder: (data: Record<string, any>) => api.post('/lab/orders', data),
  collectSample: (id: string) => api.post(`/lab/orders/${id}/collect`),
  captureResults: (id: string, resultados: any[]) => api.post(`/lab/orders/${id}/results`, { resultados }),
  release: (id: string) => api.post(`/lab/orders/${id}/release`),
  getOrder: (id: string) => api.get(`/lab/orders/${id}`),
  getPatientOrders: (pacienteId: string, page = 1) => api.get(`/lab/patients/${pacienteId}/orders`, { params: { page } }),
  getCatalog: (q?: string) => api.get('/lab/catalog', { params: { q } }),
};

export const prescriptionsApi = {
  create: (data: Record<string, any>) => api.post('/prescriptions', data),
  findByPaciente: (pacienteId: string, params?: Record<string, any>) =>
    api.get(`/prescriptions/patients/${pacienteId}`, { params }),
  findById: (id: string) => api.get(`/prescriptions/${id}`),
  dispense: (id: string) => api.post(`/prescriptions/${id}/dispense`),
  searchMeds: (q: string, controlados?: boolean) =>
    api.get('/prescriptions/medications/search', { params: { q, controlados } }),
};

export const billingApi = {
  create: (data: Record<string, any>) => api.post('/billing/invoices', data),
  findAll: (params: Record<string, any>) => api.get('/billing/invoices', { params }),
  findById: (id: string) => api.get(`/billing/invoices/${id}`),
  addCharge: (id: string, data: Record<string, any>) => api.post(`/billing/invoices/${id}/charges`, data),
  stamp: (id: string) => api.post(`/billing/invoices/${id}/stamp`),
  registerPayment: (id: string, data: Record<string, any>) => api.post(`/billing/invoices/${id}/payments`, data),
  cancel: (id: string, motivo: string) => api.post(`/billing/invoices/${id}/cancel`, { motivo }),
  export: (params: Record<string, any>) => api.get('/billing/export', { params }),
  closeCashRegister: (turno: string) => api.post('/billing/cash-register/close', { turno }),
};

export const addictionsApi = {
  createExpediente: (data: Record<string, any>) => api.post('/addictions/expedientes', data),
  getExpediente: (id: string) => api.get(`/addictions/expedientes/${id}`),
  getDashboard: (id: string) => api.get(`/addictions/expedientes/${id}/dashboard`),
  createPlan: (data: Record<string, any>) => api.post('/addictions/plans', data),
  applyInstrument: (data: Record<string, any>) => api.post('/addictions/instruments/apply', data),
  getInstruments: () => api.get('/addictions/instruments'),
  createSession: (data: Record<string, any>) => api.post('/addictions/sessions', data),
  createDiary: (data: Record<string, any>) => api.post('/addictions/diary', data),
};

export const reportsApi = {
  getOperational: (params: Record<string, any>) => api.get('/reports/operational', { params }),
  getConadic: (anio: number, trimestre: number) => api.get('/reports/conadic', { params: { anio, trimestre } }),
  getAccounting: (params: Record<string, any>) => api.get('/reports/accounting', { params }),
};

export const adminApi = {
  getDashboard: () => api.get('/admin/dashboard'),
  getOperational: (params: Record<string, any>) => api.get('/reports/operational', { params }),
  getSede: () => api.get('/admin/sede'),
  updateSede: (data: Record<string, any>) => api.patch('/admin/sede', data),
  getMedicos: () => api.get('/admin/medicos'),
  addFolios: (data: Record<string, any>) => api.post('/admin/medicos/folios-cofepris', data),
  getServices: (q?: string) => api.get('/admin/services', { params: { q } }),
  createService: (data: Record<string, any>) => api.post('/admin/services', data),
  updateService: (id: string, data: Record<string, any>) => api.patch(`/admin/services/${id}`, data),
  getIntegrations: () => api.get('/admin/integrations'),
};
