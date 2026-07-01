/**
 * Helper to download raw server response data as a file blob in the browser.
 * @param {Blob|ArrayBuffer} data - Raw response data
 * @param {string} filename - Target filename to save as
 * @param {string} mimeType - The mime type of the file (defaults to application/pdf)
 */
export const downloadBlob = (data, filename, mimeType = 'application/pdf') => {
  const blob = new Blob([data], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
