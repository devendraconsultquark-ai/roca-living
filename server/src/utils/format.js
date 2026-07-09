// Human-readable byte size, e.g. 1536 -> "1.5 KB".
export const formatBytes = (bytes) => {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.log(bytes) / Math.log(k) ? Math.floor(Math.log(bytes) / Math.log(k)) : 0;
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
