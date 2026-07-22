import api from './api';

// Property images are served through an authenticated endpoint, so they can't
// be plain <img src> URLs. Blob object-URLs are cached at module level keyed by
// image id, so a thumbnail fetched once (list page, cards) is reused across
// navigation without refetching.
const urlCache = new Map();

export const getPropertyImageUrl = (imageId) => {
  if (!urlCache.has(imageId)) {
    const promise = api
      .get(`/properties/images/${imageId}`, { responseType: 'blob', skipInterceptorError: true })
      .then((res) => window.URL.createObjectURL(res.data))
      .catch((err) => {
        urlCache.delete(imageId); // allow a retry on the next mount
        throw err;
      });
    urlCache.set(imageId, promise);
  }
  return urlCache.get(imageId);
};

export const evictPropertyImageUrl = (imageId) => {
  const cached = urlCache.get(imageId);
  if (cached) {
    urlCache.delete(imageId);
    cached.then((url) => window.URL.revokeObjectURL(url)).catch(() => {});
  }
};
