/**
 * Central API base URL — driven from environment variable.
 * Set VITE_API_URL in your .env file.
 */
export const API = import.meta.env.VITE_API_URL as string || 'http://localhost:8000/api/v1'
