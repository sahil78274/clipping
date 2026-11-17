// client/src/utils/downloadHelper.js
import api from '../services/api';

/**
 * Downloads a media file securely via authenticated Axios blob request,
 * creating an in-memory blob URL to prevent Chrome "File wasn't available on site" errors.
 *
 * @param {string} url - API endpoint (e.g. '/clips/download/123')
 * @param {string} fallbackFilename - Fallback filename if header is missing
 * @returns {Promise<{ success: boolean, filename: string }>}
 */
export async function downloadFile(url, fallbackFilename) {
  try {
    // 1. Fetch file as binary blob using Axios with Bearer token header
    const response = await api.get(url, {
      responseType: 'blob',
    });

    // 2. Validate that the response is not a JSON error message disguised as a blob
    if (response.data.type === 'application/json') {
      const text = await response.data.text();
      let errorMsg = 'Failed to download file.';
      try {
        const json = JSON.parse(text);
        errorMsg = json.message || errorMsg;
      } catch (e) {}
      throw new Error(errorMsg);
    }

    // 3. Extract filename from Content-Disposition header if available
    let filename = fallbackFilename || 'clip.mp4';
    const disposition = response.headers['content-disposition'];
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, '').trim();
      }
    }

    // 4. Create object URL and trigger reliable native download
    const blobUrl = window.URL.createObjectURL(
      new Blob([response.data], {
        type: response.headers['content-type'] || 'video/mp4',
      })
    );

    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Free memory after short delay
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 15000);

    return { success: true, filename };
  } catch (err) {
    console.error('[DownloadHelper] Error:', err);
    let message = 'Failed to download file.';
    if (err.response && err.response.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        message = json.message || message;
      } catch (e) {}
    } else if (err.response?.data?.message) {
      message = err.response.data.message;
    } else if (err.message) {
      message = err.message;
    }
    throw new Error(message);
  }
}

/**
 * Returns an authenticated download URL including ?token= query parameter
 * for native anchor hrefs (supporting right-click "Save Link As").
 */
export function getAuthenticatedDownloadUrl(url) {
  const token = localStorage.getItem('clipping_token');
  if (!token) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(token)}`;
}
