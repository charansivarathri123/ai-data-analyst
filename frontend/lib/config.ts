/**
 * Centralized Application Configuration
 * 
 * Automatically selects the appropriate backend API endpoint:
 * - In production environments (Vercel, custom domain):
 *   Defaults to the live Render backend: https://ai-data-analyst-backend-6ktz.onrender.com
 * - In local development:
 *   Defaults to http://localhost:8000
 * - If NEXT_PUBLIC_API_URL is explicitly set and valid, respects it.
 */

export function getApiBaseUrl(): string {
  // If explicitly provided via environment variable
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envUrl) {
    const cleanUrl = envUrl.replace(/\/+$/, '');
    // If in the browser on a live non-localhost domain, prevent accidentally targeting localhost
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host !== 'localhost' && host !== '127.0.0.1' && (cleanUrl.includes('localhost') || cleanUrl.includes('127.0.0.1'))) {
        return 'https://ai-data-analyst-backend-6ktz.onrender.com';
      }
    }
    return cleanUrl;
  }

  // Client-side detection: if browser is running on Vercel or any remote domain
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return 'https://ai-data-analyst-backend-6ktz.onrender.com';
    }
  }

  // Production build fallback
  if (process.env.NODE_ENV === 'production') {
    return 'https://ai-data-analyst-backend-6ktz.onrender.com';
  }

  return 'http://localhost:8000';
}

export const API_BASE = getApiBaseUrl();
