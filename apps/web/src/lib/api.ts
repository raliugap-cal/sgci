// ═══════════════════════════════════════════════════════════
// API CLIENT — Axios con interceptores JWT y sede
// ═══════════════════════════════════════════════════════════
import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://sgciapi-production.up.railway.app';

// ─── Mutex para evitar múltiples refreshes simultáneos ────
let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (err: any) => void }[] = [];

function processQueue(error: any, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
}

export function createApiClient(
  getToken: () => string | null,
  getSedeId: () => string | null,
): AxiosInstance {
  const client = axios.create({
    baseURL: `${API_BASE}/api/v1`,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.request.use((config) => {
    const token = getToken();
    const sedeId = getSedeId();
    if (token)  config.headers['Authorization'] = `Bearer ${token}`;
    if (sedeId) config.headers['X-Sede-Id'] = sedeId;
    return config;
  });

  client.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
      const originalRequest = error.config as any;

      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return axios(originalRequest);
          }).catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken = typeof window !== 'undefined'
          ? localStorage.getItem('refreshToken')
          : null;

        if (!refreshToken) {
          isRefreshing = false;
          if (typeof window !== 'undefined') window.location.href = '/login';
          return Promise.reject(error);
        }

        try {
          const { data } = await axios.post(`${API_BASE}/api/v1/auth/refresh`, { refreshToken });
          const newToken = data.accessToken;
          localStorage.setItem('accessToken', newToken);
          if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
          processQueue(null, newToken);
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return axios(originalRequest);
        } catch (err) {
          processQueue(err, null);
          localStorage.clear();
          window.location.href = '/login';
          return Promise.reject(err);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    },
  );

  return client;
}

// ─── Instancia global ─────────────────────────────────────
export const api = createApiClient(
  () => (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null),
  () => (typeof window !== 'undefined' ? localStorage.getItem('sedeId') : null),
);

// ─── Auth ─────────────────────────────────────────────────
export const authApi = {
  login:     (email: string, password: string) => api.post('/auth/login', { email, password }),
  verifyMfa: (mfaToken: string, code: string)  => api.post('/auth/mfa/verify', { mfaToken, code }),
  refresh:   (refreshToken: string)             => api.post('/auth/refresh', { refreshToken }),
  logout:    (refreshToken: string)             => api.post('/auth/logout', { refreshToken }),
  setupMfa:  ()                                 => api.post('/auth/mfa/setup', {}),
  confirmMfa:(code: string)                     => api.post('/auth/mfa/confirm', { code }),
};

// ─── Patients ─────────────────────────────────────────────
export const patientsApi = {
  list:           (params?: any)               => api.get('/patients', { params }),
  search:         (params: any)                => api.get('/patients', { params }),
  findById:       (id: string)                 => api.get(`/patients/${id}`),
  get:            (id: string)                 => api.get(`/patients/${id}`),
  create:         (data: any)                  => api.post('/patients', data),
  update:         (id: string, data: any)      => api.patch(`/patients/${id}`, data),
  clinicalSummary:(id: string)                 => api.get(`/patients/${id}/clinical-summary`),
  timeline:       (id: string)                 => api.get(`/patients/${id}/timeline`),
  activatePortal: (id: string, email: string)  => api.post(`/patients/${id}/activate-portal`, { email }),
  getArco:        (id: string)                 => api.get(`/patients/${id}/arco`),
};

// ─── Appointments ─────────────────────────────────────────
export const appointmentsApi = {
  list:           (params?: any)               => api.get('/appointments', { params }),
  findAll:        (params?: any)               => api.get('/appointments', { params }),
  findById:       (id: string)                 => api.get(`/appointments/${id}`),
  create:         (data: any)                  => api.post('/appointments', data),
  checkIn:        (id: string, data?: any)     => api.patch(`/appointments/${id}/check-in`, data ?? {}),
  cancel:         (id: string, motivo: string) => api.patch(`/appointments/${id}/cancel`, { motivo }),
  availability:   (params: any)               => api.get('/appointments/availability', { params }),
  getAvailability:(params: any)               => api.get('/appointments/availability', { params }),
  waitlist:       (data: any)                 => api.post('/appointments/waitlist', data),
};

// ─── HCE ──────────────────────────────────────────────────
export const hceApi = {
  openConsulta:   (data: any)           => api.post('/hce/consultas', data),
  closeConsulta:  (id: string)          => api.patch(`/hce/consultas/${id}/close`, {}),
  getConsulta:    (id: string)          => api.get(`/hce/consultas/${id}`),
  createConsulta: (data: any)           => api.post('/hce/consultas', data),
  updateConsulta: (id: string, d: any)  => api.patch(`/hce/consultas/${id}`, d),
  signConsulta:   (id: string)          => api.post(`/hce/consultas/${id}/sign`, {}),
  getExpediente:  (pacienteId: string)  => api.get(`/hce/expediente/${pacienteId}`),
  createNota:     (id: string, d: any)  => api.post(`/hce/consultas/${id}/notas`, d),
  updateNota:     (id: string, d: any)  => api.patch(`/hce/notas/${id}`, d),
  signNota:       (id: string)          => api.post(`/hce/notas/${id}/sign`, {}),
  upsertVitals:   (id: string, d: any)  => api.post(`/hce/consultas/${id}/vitales`, d),
  addDiagnosis:   (id: string, d: any)  => api.post(`/hce/consultas/${id}/diagnosticos`, d),
  searchCie10:    (q: string)           => api.get('/hce/cie10', { params: { q } }),
};

// ─── Lab ──────────────────────────────────────────────────
export const labApi = {
  createOrden:    (data: any)           => api.post('/lab/ordenes', data),
  createOrder:    (data: any)           => api.post('/lab/ordenes', data),
  getOrden:       (id: string)          => api.get(`/lab/ordenes/${id}`),
  list:           (params?: any)        => api.get('/lab/ordenes', { params }),
  capturarResult: (id: string, d: any)  => api.patch(`/lab/ordenes/${id}/resultados`, d),
  captureResults: (id: string, d: any)  => api.patch(`/lab/ordenes/${id}/resultados`, d),
  collectSample:  (id: string, d: any)  => api.patch(`/lab/ordenes/${id}/muestra`, d),
  release:        (id: string)          => api.patch(`/lab/ordenes/${id}/liberar`, {}),
  getCatalog:     ()                    => api.get('/lab/catalogo'),
  getPdf:         (id: string)          => api.get(`/lab/ordenes/${id}/pdf`, { responseType: 'blob' }),
};

// ─── Prescriptions ────────────────────────────────────────
export const prescriptionsApi = {
  create:         (data: any)           => api.post('/prescriptions', data),
  get:            (id: string)          => api.get(`/prescriptions/${id}`),
  list:           (params?: any)        => api.get('/prescriptions', { params }),
  findByPaciente: (id: string)          => api.get('/prescriptions', { params: { pacienteId: id } }),
  searchMeds:     (q: string)           => api.get('/prescriptions/medicamentos', { params: { q } }),
  getPdf:         (id: string)          => api.get(`/prescriptions/${id}/pdf`, { responseType: 'blob' }),
  cancel:         (id: string)          => api.patch(`/prescriptions/${id}/cancel`, {}),
};

// ─── Billing ──────────────────────────────────────────────
export const billingApi = {
  createInvoice:    (data: any)                   => api.post('/billing/invoices', data),
  create:           (data: any)                   => api.post('/billing/invoices', data),
  getInvoice:       (id: string)                  => api.get(`/billing/invoices/${id}`),
  findById:         (id: string)                  => api.get(`/billing/invoices/${id}`),
  list:             (params?: any)                => api.get('/billing/invoices', { params }),
  findAll:          (params?: any)                => api.get('/billing/invoices', { params }),
  addCharge:        (id: string, data: any)       => api.post(`/billing/invoices/${id}/charges`, data),
  stamp:            (id: string)                  => api.post(`/billing/invoices/${id}/stamp`, {}),
  registerPayment:  (id: string, data: any)       => api.post(`/billing/invoices/${id}/payments`, data),
  cancel:           (id: string, motivo: string)  => api.post(`/billing/invoices/${id}/cancel`, { motivo }),
  export:           (params: any)                 => api.get('/billing/export', { params }),
  closeCashRegister:(turno: string)               => api.post('/billing/cash-register/close', { turno }),
};

// ─── Addictions ───────────────────────────────────────────
export const addictionsApi = {
  createExpediente: (data: any)          => api.post('/addictions/expedientes', data),
  getExpediente:    (id: string)         => api.get(`/addictions/expedientes/${id}`),
  listExpedientes:  (params?: any)       => api.get('/addictions/expedientes', { params }),
  getDashboard:     (id: string)         => api.get(`/addictions/expedientes/${id}/dashboard`),
  getSesiones:      (id: string)         => api.get(`/addictions/expedientes/${id}/sesiones`),
  createSesion:     (id: string, d: any) => api.post(`/addictions/expedientes/${id}/sesiones`, d),
  createSession:    (id: string, d: any) => api.post(`/addictions/expedientes/${id}/sesiones`, d),
  getPti:           (id: string)         => api.get(`/addictions/expedientes/${id}/pti`),
  createPti:        (id: string, d: any) => api.post(`/addictions/expedientes/${id}/pti`, d),
  createPlan:       (id: string, d: any) => api.post(`/addictions/expedientes/${id}/pti`, d),
  getDiario:        (id: string)         => api.get(`/addictions/expedientes/${id}/diario`),
  getInstruments:   ()                   => api.get('/addictions/instrumentos'),
  applyInstrument:  (id: string, d: any) => api.post(`/addictions/expedientes/${id}/instrumentos`, d),
};

// ─── Reports ──────────────────────────────────────────────
export const reportsApi = {
  operational:    (params: any) => api.get('/reports/operational', { params }),
  getOperational: (params: any) => api.get('/reports/operational', { params }),
  conadic:        (params: any) => api.get('/reports/conadic', { params }),
  getConadic:     (params: any) => api.get('/reports/conadic', { params }),
  accounting:     (params: any) => api.get('/reports/accounting', { params }),
};

// ─── Admin ────────────────────────────────────────────────
export const adminApi = {
  getSede:        ()                    => api.get('/admin/sede'),
  updateSede:     (data: any)           => api.patch('/admin/sede', data),
  getDashboard:   ()                    => api.get('/admin/dashboard'),
  getOperational: (params: any)         => api.get('/admin/dashboard', { params }),
  getStaff:       (params?: any)        => api.get('/admin/staff', { params }),
  createStaff:    (data: any)           => api.post('/admin/staff', data),
  updateStaff:    (id: string, d: any)  => api.patch(`/admin/staff/${id}`, d),
  toggleStaff:    (id: string)          => api.patch(`/admin/staff/${id}/toggle`, {}),
  getMedicos:     (params?: any)        => api.get('/admin/medicos', { params }),
  getServices:    ()                    => api.get('/admin/servicios'),
  getServicios:   ()                    => api.get('/admin/servicios'),
  createService:  (data: any)           => api.post('/admin/servicios', data),
  createServicio: (data: any)           => api.post('/admin/servicios', data),
  updateServicio: (id: string, d: any)  => api.patch(`/admin/servicios/${id}`, d),
  getIntegrations:()                    => api.get('/admin/integraciones'),
  addFolios:      (data: any)           => api.post('/admin/folios', data),
};

// ─── Staff ────────────────────────────────────────────────
export const staffApi = {
  findAll:        (params?: any)        => api.get('/staff', { params }),
  create:         (data: any)           => api.post('/staff', data),
  createMedico:   (data: any)           => api.post('/staff/medicos', data),
  toggle:         (id: string)          => api.patch(`/staff/${id}/toggle`, {}),
  resetPassword:  (id: string)          => api.post(`/staff/${id}/reset-password`, {}),
};

// ─── Almacen ──────────────────────────────────────────────
export const almacenApi = {
  findAll:    (params?: any)        => api.get('/almacen', { params }),
  create:     (data: any)           => api.post('/almacen', data),
  entrada:    (id: string, d: any)  => api.post(`/almacen/${id}/entrada`, d),
  salida:     (id: string, d: any)  => api.post(`/almacen/${id}/salida`, d),
  alertas:    ()                    => api.get('/almacen/alertas'),
  caducidades:()                    => api.get('/almacen/caducidades'),
};

// ─── Sedes ────────────────────────────────────────────────
export const sedesApi = {
  list:             ()                              => api.get('/sedes'),
  get:              (id: string)                    => api.get(`/sedes/${id}`),
  create:           (data: any)                     => api.post('/sedes', data),
  update:           (id: string, data: any)         => api.patch(`/sedes/${id}`, data),
  toggleActiva:     (id: string)                    => api.patch(`/sedes/${id}/toggle-activa`, {}),
  getMedicosDisp:   (id: string)                    => api.get(`/sedes/${id}/medicos-disponibles`),
  asignarMedico:    (id: string, data: any)         => api.post(`/sedes/${id}/medicos`, data),
  desasignarMedico: (id: string, medicoId: string)  => api.delete(`/sedes/${id}/medicos/${medicoId}`),
};
