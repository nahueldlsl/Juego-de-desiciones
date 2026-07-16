import { create } from 'zustand';

/**
 * Helper to decode JWT token without external libraries
 */
const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(window.atob(base64));
  } catch (e) {
    return null;
  }
};

const useAuthStore = create((set) => ({
  token: localStorage.getItem('token') || null,
  user: null,
  isAuthenticated: !!localStorage.getItem('token'),
  role: 'GUEST', // 'GUEST', 'ADMIN' (Profesor), 'SUPERADMIN'
  loading: false,

  login: (token) => {
    localStorage.setItem('token', token);
    const decoded = decodeToken(token);
    
    let derivedRole = 'ADMIN';
    if (decoded?.is_superuser) {
      derivedRole = 'SUPERADMIN';
    } else if (decoded?.groups && !decoded.groups.includes('Profesores')) {
      derivedRole = 'USER';
    }

    set({
      token,
      isAuthenticated: true,
      user: decoded,
      role: derivedRole,
      loading: false
    });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({
      token: null,
      isAuthenticated: false,
      user: null,
      role: 'GUEST',
      loading: false
    });
  },

  initialize: () => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = decodeToken(token);
      if (decoded && decoded.exp * 1000 > Date.now()) {
        let derivedRole = 'ADMIN';
        if (decoded?.is_superuser) {
          derivedRole = 'SUPERADMIN';
        } else if (decoded?.groups && !decoded.groups.includes('Profesores')) {
          derivedRole = 'USER';
        }
        set({
          token,
          isAuthenticated: true,
          user: decoded,
          role: derivedRole,
          loading: false
        });
        return;
      }
    }
    set({ token: null, isAuthenticated: false, user: null, role: 'GUEST', loading: false });
  }
}));

export default useAuthStore;
