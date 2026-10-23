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

const send = async (method, path, { body, form, actingFor } = {}) => {
  if (!estatesApiReady()) {
    throw new ApiError(503, 'Editing ROCA Estates from Roca Living is not set up yet (ROCAEM_API_URL and ROCAEM_API_KEY).');
  }
  try {
    return await fetch(`${baseUrl()}${path}`, {
      method,
      headers: {
        // FormData sets its own multipart Content-Type (with the boundary).
        ...(form ? {} : { 'Content-Type': 'application/json' }),
        'X-Service-Key': process.env.ROCAEM_API_KEY,
        'X-Acting-User': actingFor || ''
      },
      body: form || (body ? JSON.stringify(body) : undefined),
      signal: AbortSignal.timeout(form ? 60000 : 15000)
    });
  } catch (err) {
    logger.error(`[EstatesApi] ${method} ${path} failed: ${err.message}`);
    throw new ApiError(503, 'ROCA Estates is not available right now. Please try again shortly.');
  }
};

const answer = async (res) => {
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

export const estatesApi = async (method, path, opts = {}) => answer(await send(method, path, opts));

// Multipart write: plain fields plus files ({ field, buffer, name, type }).
export const estatesUpload = async (method, path, { fields = {}, files = [], actingFor } = {}) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null) form.append(k, String(v));
  for (const f of files) form.append(f.field, new Blob([f.buffer], { type: f.type || 'application/octet-stream' }), f.name);
  return answer(await send(method, path, { form, actingFor }));
};

// A ROCA Estates file passed straight to the browser (inline, or as a download).
export const estatesStream = async (path, res, { download = false, name } = {}) => {
  const up = await send('GET', path);
  if (!up.ok) {
    const json = await up.json().catch(() => ({}));
    throw new ApiError(up.status === 404 ? 404 : 502, json.message || 'File not found in ROCA Estates');
  }
  const type = up.headers.get('content-type') || 'application/octet-stream';
  const upName = (up.headers.get('content-disposition') || '').match(/filename="?([^";]+)"?/i)?.[1];
  const filename = String(name || upName || 'file').replace(/["\\\r\n]/g, '');
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${filename}"`);
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.send(Buffer.from(await up.arrayBuffer()));
};
