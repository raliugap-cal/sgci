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

  // Request: inyectar token y sede
  client.interceptors.request.use((config) => {
    const token = getToken();
    const sedeId = getSedeId();
    if (token) config.headers['Authorization'] = `Bearer ${token}`;
    if (sedeId) config.headers['X-Sede-Id'] = sedeId;
    return config;
  });

  // Response: manejar 401 con mutex para evitar múltiples refreshes
  client.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
      const originalRequest = error.config as any;

      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          // Encolar la request mientras se hace refresh
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

// ─── Servicios organizados por dominio ────────────────────
export const authApi = {
  login:     (email: string, password: string) => api.post('/auth/login', { email, password }),
  verifyMfa: (mfaToken: string, code: string)  => api.post('/auth/mfa/verify', { mfaToken, code }),
  refresh:   (refreshToken: string)             => api.post('/auth/refresh', { refreshToken }),
  logout:    (refreshToken: string)             => api.post('/auth/logout', { refreshToken }),
  setupMfa:  ()                                 => api.post('/auth/mfa/setup', {}),
  confirmMfa:(code: string)                     => api.post('/auth/mfa/confirm', { code }),
};

export const patientsApi = {
  list:           (params?: any)               => api.get('/patients', { params }),
  get:            (id: string)                 => api.get(`/patients/${id}`),
  create:         (data: any)                  => api.post('/patients', data),
  update:         (id: string, data: any)      => api.patch(`/patients/${id}`, data),
  clinicalSummary:(id: string)                 => api.get(`/patients/${id}/clinical-summary`),
  activatePortal: (id: string, email: string)  => api.post(`/patients/${id}/activate-portal`, { email }),
  search:         (params: any)                => api.get('/patients', { params }),
};

export const appointmentsApi = {
  list:         (params?: any)                  => api.get('/appointments', { params }),
  create:       (data: any)                     => api.post('/appointments', data),
  checkIn:      (id: string, data?: any)        => api.patch(`/appointments/${id}/check-in`, data ?? {}),
  cancel:       (id: string, motivo: string)    => api.patch(`/appointments/${id}/cancel`, { motivo }),
  availability: (params: any)                   => api.get('/appointments/availability', { params }),
  waitlist:     (data: any)                     => api.post('/appointments/waitlist', data),
};

export const hceApi = {
  getConsulta:    (id: string)          => api.get(`/hce/consultas/${id}`),
  createConsulta: (data: any)           => api.post('/hce/consultas', data),
  updateConsulta: (id: string, d: any)  => api.patch(`/hce/consultas/${id}`, d),
  signConsulta:   (id: string)          => api.post(`/hce/consultas/${id}/sign`, {}),
  getExpediente:  (pacienteId: string)  => api.get(`/hce/expediente/${pacienteId}`),
};

export const labApi = {
  createOrden:    (data: any)           => api.post('/lab/ordenes', data),
  getOrden:       (id: string)          => api.get(`/lab/ordenes/${id}`),
  list:           (params?: any)        => api.get('/lab/ordenes', { params }),
  capturarResult: (id: string, d: any)  => api.patch(`/lab/ordenes/${id}/resultados`, d),
  getPdf:         (id: string)          => api.get(`/lab/ordenes/${id}/pdf`, { responseType: 'blob' }),
};

export const prescriptionsApi = {
  create:  (data: any)          => api.post('/prescriptions', data),
  get:     (id: string)         => api.get(`/prescriptions/${id}`),
  list:    (params?: any)       => api.get('/prescriptions', { params }),
  getPdf:  (id: string)         => api.get(`/prescriptions/${id}/pdf`, { responseType: 'blob' }),
  cancel:  (id: string)         => api.patch(`/prescriptions/${id}/cancel`, {}),
};

export const billingApi = {
  createInvoice:   (data: any)                      => api.post('/billing/invoices', data),
  getInvoice:      (id: string)                     => api.get(`/billing/invoices/${id}`),
  list:            (params?: any)                   => api.get('/billing/invoices', { params }),
  addCharge:       (id: string, data: any)          => api.post(`/billing/invoices/${id}/charges`, data),
  stamp:           (id: string)                     => api.post(`/billing/invoices/${id}/stamp`, {}),
  registerPayment: (id: string, data: any)          => api.post(`/billing/invoices/${id}/payments`, data),
  cancel:          (id: string, motivo: string)     => api.post(`/billing/invoices/${id}/cancel`, { motivo }),
  export:          (params: any)                    => api.get('/billing/export', { params }),
};

export const addictionsApi = {
  getDashboard:     (id: string)         => api.get(`/addictions/expedientes/${id}/dashboard`),
  getSesiones:      (id: string)         => api.get(`/addictions/expedientes/${id}/sesiones`),
  getPti:           (id: string)         => api.get(`/addictions/expedientes/${id}/pti`),
  getDiario:        (id: string)         => api.get(`/addictions/expedientes/${id}/diario`),
  createExpediente: (data: any)          => api.post('/addictions/expedientes', data),
  getExpediente:    (id: string)         => api.get(`/addictions/expedientes/${id}`),
  listExpedientes:  (params?: any)       => api.get('/addictions/expedientes', { params }),
  createSesion:     (id: string, d: any) => api.post(`/addictions/expedientes/${id}/sesiones`, d),
  createPti:        (id: string, d: any) => api.post(`/addictions/expedientes/${id}/pti`, d),
};

export const reportsApi = {
  operational: (params: any) => api.get('/reports/operational', { params }),
  conadic:     (params: any) => api.get('/reports/conadic', { params }),
  accounting:  (params: any) => api.get('/reports/accounting', { params }),
};

export const adminApi = {
  getSede:        ()             => api.get('/admin/sede'),
  updateSede:     (data: any)    => api.patch('/admin/sede', data),
  getStaff:       (params?: any) => api.get('/admin/staff', { params }),
  createStaff:    (data: any)    => api.post('/admin/staff', data),
  updateStaff:    (id: string, d: any) => api.patch(`/admin/staff/${id}`, d),
  toggleStaff:    (id: string)   => api.patch(`/admin/staff/${id}/toggle`, {}),
  getServicios:   ()             => api.get('/admin/servicios'),
  createServicio: (data: any)    => api.post('/admin/servicios', data),
  updateServicio: (id: string, d: any) => api.patch(`/admin/servicios/${id}`, d),
};

export const sedesApi = {
  list:               ()                            => api.get('/sedes'),
  get:                (id: string)                  => api.get(`/sedes/${id}`),
  create:             (data: any)                   => api.post('/sedes', data),
  update:             (id: string, data: any)       => api.patch(`/sedes/${id}`, data),
  toggleActiva:       (id: string)                  => api.patch(`/sedes/${id}/toggle-activa`, {}),
  getMedicosDisp:     (id: string)                  => api.get(`/sedes/${id}/medicos-disponibles`),
  asignarMedico:      (id: string, data: any)       => api.post(`/sedes/${id}/medicos`, data),
  desasignarMedico:   (id: string, medicoId: string)=> api.delete(`/sedes/${id}/medicos/${medicoId}`),
};
