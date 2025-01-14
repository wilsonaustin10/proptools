// API configuration
const API_BASE_URL = '';  // Use relative URLs

// Helper function to construct API URLs
export function getApiUrl(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}
