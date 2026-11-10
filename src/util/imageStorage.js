// Single upload/delete path for every picked image (vehicles, services,
// documents, fuel receipts, avatars). Images go to the Zecodeek media server,
// not Firebase Storage.

const MEDIA_BASE = 'https://apidailysalah.zecodeek-it.com/media';
const UPLOAD_URL = `${MEDIA_BASE}/upload.php`;
const DELETE_URL = `${MEDIA_BASE}/delete.php`;
const UPLOAD_TIMEOUT_MS = 60000;

const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  gif: 'image/gif',
};

// Only files on our own server can be removed — avatars may be Google photo
// URLs and older records may point at Firebase Storage.
const isOwnMediaUrl = url => typeof url === 'string' && url.startsWith(`${MEDIA_BASE}/`);

// Resolves to { success, url } — the shape every call site already checks —
// plus a user-facing `message` on failure.
export const uploadImage = async localUri => {
  if (!localUri) return { success: false, message: 'No photo was selected.' };

  const filename = (localUri.split('/').pop() || 'image.jpg').split('?')[0];
  const ext = filename.split('.').pop()?.toLowerCase();

  const formData = new FormData();
  formData.append('photo', {
    uri: localUri,
    type: MIME_BY_EXT[ext] || 'image/jpeg',
    name: filename,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    // No Content-Type header: fetch adds the multipart boundary itself.
    const response = await fetch(UPLOAD_URL, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    const rawText = await response.text();

    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error('Image upload: non-JSON response', response.status, rawText);
    }

    if (data?.success && data.url) return { success: true, url: data.url };

    console.error('Image upload rejected:', response.status, data?.error || rawText);
    return {
      success: false,
      message:
        response.status === 413
          ? 'This photo is too large. Pick a smaller one.'
          : "The photo couldn't be uploaded. Try a different photo or try again.",
    };
  } catch (error) {
    console.error('Image upload failed:', error?.name, error?.message);
    return {
      success: false,
      error,
      message:
        error?.name === 'AbortError'
          ? 'The photo upload took too long. Remove the photo to save now, and add it later.'
          : "The photo couldn't be uploaded. You may be offline. Remove the photo to save now, and add it later.",
    };
  } finally {
    clearTimeout(timer);
  }
};

// Best-effort: a failed delete only leaves an orphaned file on the server.
export const deleteImage = async url => {
  if (!isOwnMediaUrl(url)) return;
  try {
    await fetch(DELETE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
  } catch (error) {
    console.error('Image delete failed:', error);
  }
};
