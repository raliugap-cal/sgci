// ═══════════════════════════════════════════════════════════
// AUTH STORE — Zustand (persiste en localStorage)
// ═══════════════════════════════════════════════════════════
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  nombre: string;
  email: string;
  roles: string[];
  sedeId: string;
  medicoId: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  sedeId: string | null;
  mfaPending: boolean;
  mfaToken: string | null;

  setSession: (data: {
    accessToken: string;
    refreshToken: string;
    user: User;
  }) => void;
  setMfaPending: (mfaToken: string) => void;
  setSede: (sedeId: string) => void;
  clearSession: () => void;

  isAuthenticated: () => boolean;
  hasRole: (role: string) => boolean;
  isMedico: () => boolean;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      sedeId: null,
      mfaPending: false,
      mfaToken: null,

      setSession: ({ accessToken, refreshToken, user }) => {
        set({
          user,
          accessToken,
          refreshToken,
          sedeId: user.sedeId,
          mfaPending: false,
          mfaToken: null,
        });
        // También en localStorage para el cliente API
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('sedeId', user.sedeId);
      },

      setMfaPending: (mfaToken) => set({ mfaPending: true, mfaToken }),

      setSede: (sedeId) => {
        set({ sedeId });
        localStorage.setItem('sedeId', sedeId);
      },

      clearSession: () => {
        set({ user: null, accessToken: null, refreshToken: null, sedeId: null, mfaPending: false, mfaToken: null });
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('sedeId');
      },

      isAuthenticated: () => !!get().accessToken && !!get().user,
      hasRole: (role) => get().user?.roles.includes(role) ?? false,
      isMedico: () => !!get().user?.medicoId,
      isAdmin: () => get().user?.roles.some(r => ['SUPERADMIN', 'ADMIN_SEDE'].includes(r)) ?? false,
    }),
    {
      name: 'sgci-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        sedeId: state.sedeId,
      }),
    },
  ),
);
