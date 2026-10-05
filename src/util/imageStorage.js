import auth from '@react-native-firebase/auth';
import storage from '@react-native-firebase/storage';

// Single upload/delete path for every picked image (vehicles, services,
// documents, fuel receipts, avatars). Files live under users/{uid}/ so the
// Storage security rules can restrict each user to their own folder.

const isFirebaseStorageUrl = url =>
  typeof url === 'string' &&
  (url.includes('firebasestorage.googleapis.com') || url.startsWith('gs://'));

// Resolves to { success, url } — the shape every call site already checks.
export const uploadImage = async (localUri, folder = 'images') => {
  const uid = auth().currentUser?.uid;
  if (!uid || !localUri) return { success: false };

  try {
    const filename = (localUri.split('/').pop() || 'image.jpg').split('?')[0];
    const ref = storage().ref(`users/${uid}/${folder}/${Date.now()}-${filename}`);
    await ref.putFile(localUri, { contentType: 'image/jpeg' });
    const url = await ref.getDownloadURL();
    return { success: true, url };
  } catch (error) {
    console.error('Image upload failed:', error);
    return { success: false, error };
  }
};

// Best-effort: images from the legacy PHP server can't be removed from here,
// so only Firebase Storage URLs are deleted.
export const deleteImage = async url => {
  if (!isFirebaseStorageUrl(url)) return;
  try {
    await storage().refFromURL(url).delete();
  } catch (error) {
    if (error?.code !== 'storage/object-not-found') {
      console.error('Image delete failed:', error);
    }
  }
};
