import { ApiError } from './ApiError.js';
import logger from './logger.js';

// ROCA Estates' own admin API, used to add, change and delete its landlords
// and apartments from Roca Living. Writes go through ROCA Estates (never
// straight into its database) so its own rules, codes and checks apply.
// Roca Living sends a service key and the acting admin's email; ROCA Estates
// acts as its dedicated "ROCA Living (system)" admin and logs the change.
// Server to server only: no Origin header, so ROCA Estates' CSRF check passes.

const baseUrl = () => String(process.env.ROCAEM_API_URL || '').replace(/\/+$/, '');

export const estatesApiReady = () => !!(process.env.ROCAEM_API_URL && process.env.ROCAEM_API_KEY);

export const estatesApi = async (method, path, { body, actingFor } = {}) => {
  if (!estatesApiReady()) {
    throw new ApiError(503, 'Editing ROCA Estates from Roca Living is not set up yet (ROCAEM_API_URL and ROCAEM_API_KEY).');
  }
  let res;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': process.env.ROCAEM_API_KEY,
        'X-Acting-User': actingFor || ''
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000)
    });
  } catch (err) {
    logger.error(`[EstatesApi] ${method} ${path} failed: ${err.message}`);
    throw new ApiError(503, 'ROCA Estates is not available right now. Please try again shortly.');
  }
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      logger.error(`[EstatesApi] ROCA Estates refused the service key: ${json.message || res.status}`);
      throw new ApiError(503, 'ROCA Estates refused Roca Living. Check ROCAEM_API_KEY and the ROCA Living service user in ROCA Estates.');
    }
    // ROCA Estates' own validation messages ("Unit 7 already exists…") go to the user as they are.
    throw new ApiError(res.status >= 500 ? 502 : res.status, json.message || `ROCA Estates answered ${res.status}`);
  }
  return json.data;
};
