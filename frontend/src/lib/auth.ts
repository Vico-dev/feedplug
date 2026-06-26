import { apiClient } from './api';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  accountId: string;
  trialEndsAt?: string | null;
  billingStatus?: string | null;
  paymentGraceUntil?: string | null;
  /** true si staff FeedPlug (accès leads, admin, etc.) — distinct du rôle OWNER client */
  isStaff?: boolean;
  account?: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  accountName: string;
  captchaToken?: string;
  companyWebsite?: string;
  formStartedAt?: number;
}

export interface AuthResponse {
  user: User;
  accessToken?: string;
  refreshToken?: string;
  // Présent uniquement sur /auth/google : true au premier sign-in Google sur
  // un compte initialement créé avec mot de passe (lien fait à la volée).
  linked?: boolean;
}

export interface RefreshTokenResponse {
  accessToken?: string;
  refreshToken?: string;
}

class AuthService {
  private user: User | null = null;

  constructor() {
    this.loadUserFromStorage();
  }

  private loadUserFromStorage() {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          this.user = JSON.parse(storedUser);
        } catch (error) {
          console.error('Error parsing stored user:', error);
          this.clearAuth();
        }
      }
    }
  }

  private saveUserToStorage(user: User) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user));
    }
    this.user = user;
  }

  private clearAuth() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
    }
    this.user = null;
    apiClient.setToken(null);
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
      const { user } = response.data;
      this.saveUserToStorage(user);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/register', data);
      const { user } = response.data;
      this.saveUserToStorage(user);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async loginWithGoogle(credential: string): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/google', { credential });
      const { user } = response.data;
      this.saveUserToStorage(user);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Logout API call failed:', error);
    } finally {
      this.clearAuth();
      // Rediriger vers la page de connexion — SAUF dans l'app embarquée Shopify.
      // L'embarqué s'authentifie par session token Shopify (pas le JWT SaaS) ;
      // un window.location vers /login ferait SORTIR le marchand de l'iframe
      // Shopify vers la page de login SaaS standalone (bug constaté sur /embedded/channels).
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/embedded')) {
        window.location.href = '/login';
      }
    }
  }

  async refreshToken(): Promise<RefreshTokenResponse> {
    try {
      const response = await apiClient.post<RefreshTokenResponse>('/auth/refresh');
      return response.data ?? {};
    } catch (error) {
      this.clearAuth();
      throw error;
    }
  }

  async getCurrentUser(forceRefresh = false): Promise<User | null> {
    if (this.user && !forceRefresh) {
      return this.user;
    }

    try {
      const response = await apiClient.get<User>('/auth/me');
      this.saveUserToStorage(response.data);
      return response.data;
    } catch {
      this.clearAuth();
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!this.user;
  }

  getCurrentUserSync(): User | null {
    return this.user;
  }

  hasRole(role: string): boolean {
    return this.user?.role === role;
  }

  hasPermission(permission: string): boolean {
    void permission;
    // This would need to be implemented based on your permission system
    return this.isAuthenticated();
  }
}

export const authService = new AuthService();
