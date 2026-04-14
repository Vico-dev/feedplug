import { getFeedplugApiBaseUrl } from "@/config/api";

function getApiBaseUrl(): string {
  return getFeedplugApiBaseUrl();
}

export const API_BASE_URL = getApiBaseUrl();

/**
 * Fetch authentifié — ajoute automatiquement le token JWT.
 * Utiliser à la place de fetch() pour toutes les requêtes API.
 */
export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: HeadersInit = { ...(options.headers || {}) };
  return fetch(url, { ...options, headers, credentials: 'include', mode: 'cors' });
}

export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  status: number;
}

export interface ApiError {
  message: string;
  status: number;
  errors?: Record<string, string[]>;
  response?: unknown;
  originalError?: unknown;
}

class ApiClient {
  private baseURL: string;
  /** Callback appelé sur 401 : tente un refresh puis retourne true si succès. Utilisé pour retry automatique. */
  private on401: (() => Promise<boolean>) | null = null;
  private inflightGetRequests = new Map<string, Promise<ApiResponse<unknown>>>();

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  setOn401(fn: () => Promise<boolean>) {
    this.on401 = fn;
  }

  setToken(token: string | null) {
    void token;
    // Auth pilotée par cookies HttpOnly gérés côté proxy Next.js.
  }

  private getInflightRequestKey(url: string, headers: HeadersInit): string {
    const normalizedHeaders = new Headers(headers);
    const headerPairs = Array.from(normalizedHeaders.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join("|");
    return `GET:${url}:${headerPairs}`;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetryAfter401 = false
  ): Promise<ApiResponse<T>> {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseURL.replace(/\/+$/, '')}${path}`;
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 API Request URL:', url);
      console.log('🔍 API Base URL:', this.baseURL);
    }
    
    const headers = new Headers(options.headers || {});
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const method = (options.method || 'GET').toUpperCase();
    const inflightRequestKey = method === 'GET' && !options.signal ? this.getInflightRequestKey(url, headers) : null;
    if (inflightRequestKey) {
      const inflight = this.inflightGetRequests.get(inflightRequestKey);
      if (inflight) {
        return inflight as Promise<ApiResponse<T>>;
      }
    }

    const executeRequest = async (): Promise<ApiResponse<T>> => {
      try {
      const response = await fetch(url, {
        ...options,
        headers,
        mode: 'cors',
        credentials: 'include', // requis pour CORS quand le backend envoie Allow-Credentials: true
      });

      let data: unknown;
      // Gérer les réponses 204 (No Content) qui n'ont pas de body
      if (response.status === 204) {
        data = null;
      } else {
        const contentType = response.headers.get('content-type');
        // Cloner la réponse pour pouvoir lire le texte plusieurs fois si nécessaire
        const text = await response.text();
        
        if (contentType && contentType.includes('application/json')) {
          try {
            data = text ? JSON.parse(text) : null;
          } catch (parseError) {
            // Si le parsing échoue, essayer de retourner null pour les réponses OK
            if (response.ok) {
              data = null;
            } else {
              if (process.env.NODE_ENV !== 'production') {
                console.error('🔍 JSON parse error:', parseError);
              }
              throw {
                message: `Réponse invalide du serveur: ${text.substring(0, 100)}`,
                status: response.status,
              } as ApiError;
            }
          }
        } else {
          // Pour les réponses non-JSON (ex. page HTML d'erreur 404/502)
          if (text && response.status >= 400) {
            if (process.env.NODE_ENV !== 'production') {
              console.error('🔍 Non-JSON response:', text.substring(0, 200));
            }
            const friendlyMessage =
              response.status === 404
                ? `Route non trouvée (${endpoint}). Vérifiez que le backend est à jour et redéployé.`
                : response.status >= 502
                  ? "Service temporairement indisponible. Réessayez dans un instant."
                  : "Le serveur a renvoyé une erreur. Réessayez ou contactez le support.";
            throw {
              message: friendlyMessage,
              status: response.status,
            } as ApiError;
          }
          // Pour les réponses OK non-JSON, retourner null
          data = null;
        }
      }

      if (!response.ok) {
        const responseData =
          data && typeof data === 'object' && !Array.isArray(data)
            ? (data as { message?: unknown; error?: unknown; errors?: Record<string, string[]> })
            : null;
        const rawMessage = responseData?.message ?? responseData?.error;
        const message = typeof rawMessage === 'string' ? rawMessage : Array.isArray(rawMessage) ? rawMessage.join(' ') : '';
        const isTokenError =
          response.status === 401 ||
          (response.status === 403 &&
            (message.includes('Token invalide') || message.includes('Compte non associé au token')));
        // 401 ou 403 "token" : tenter un refresh puis retry une seule fois (sauf pour /auth/refresh)
        if (
          isTokenError &&
          !isRetryAfter401 &&
          !endpoint.startsWith('/auth/') &&
          this.on401
        ) {
          const refreshed = await this.on401();
          if (refreshed) return this.request<T>(endpoint, options, true);
        }
        if (process.env.NODE_ENV !== 'production') {
          console.error('🔍 API Error Response:', data);
        }
        const error: ApiError = {
          message: message || 'Une erreur est survenue',
          status: response.status,
          errors: responseData?.errors,
          response: data,
        };
        throw error;
      }

      return {
        data: data as T,
        status: response.status,
      };
    } catch (error: unknown) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('🔍 API Request Error:', error);
        console.error('🔍 Error type:', typeof error);
        console.error('🔍 Error instanceof TypeError:', error instanceof TypeError);
        try { console.error('🔍 Error details:', JSON.stringify(error, null, 2)); } catch {}
      }

      const errorMessage =
        error instanceof Error ? error.message : (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string')
          ? (error as { message: string }).message
          : '';

      if (error instanceof TypeError || errorMessage.includes('fetch')) {
        // Erreur réseau ou CORS (le navigateur bloque la réponse)
        console.error('🔍 Network error detected', error);
        throw {
          message: 'Impossible de se connecter au serveur. Vérifiez votre connexion ou réessayez dans quelques instants (F12 > Console pour détails).',
          status: 0,
          originalError: error,
        } as ApiError;
      }
      
      // Si c'est déjà un ApiError, le relancer tel quel
      if (typeof error === 'object' && error !== null && 'status' in error) {
        throw error;
      }
      
      // Sinon, wrapper l'erreur
      throw {
        message: errorMessage || 'Une erreur inattendue est survenue',
        status: 0,
        originalError: error,
      } as ApiError;
    }
    };

    const requestPromise = executeRequest();
    if (inflightRequestKey) {
      this.inflightGetRequests.set(inflightRequestKey, requestPromise as Promise<ApiResponse<unknown>>);
      requestPromise.finally(() => {
        if (this.inflightGetRequests.get(inflightRequestKey) === requestPromise) {
          this.inflightGetRequests.delete(inflightRequestKey);
        }
      });
    }
    return requestPromise;
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async postForm<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
      headers: {},
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
