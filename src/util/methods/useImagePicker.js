import { useState } from 'react';
import { Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';

// Shared picker options. Uses the system Photo Picker (no media permission —
// required by Google Play). Downscaling keeps uploads well under the 10 MB cap
// in storage.rules; full-resolution camera photos can exceed it.
export const IMAGE_PICKER_OPTIONS = {
  mediaType: 'photo',
  quality: 0.7,
  maxWidth: 1600,
  maxHeight: 1600,
  selectionLimit: 1,
};

const PHOTO_ACCESS_KEY = 'photoAccessGranted';

// The consent sheet (PhotoAccessModal, mounted in App.jsx) registers here.
let showPrompt = null;
export const subscribePhotoAccess = (listener) => {
  showPrompt = listener;
  return () => {
    if (showPrompt === listener) showPrompt = null;
  };
};

/**
 * The Photo Picker needs no OS permission, so the app asks for consent itself
 * the first time. Resolves true once the user has allowed photo access.
 */
const ensurePhotoAccess = async () => {
  try {
    if ((await AsyncStorage.getItem(PHOTO_ACCESS_KEY)) === 'true') return true;
  } catch {}
  if (!showPrompt) return true;

  Keyboard.dismiss();
  const granted = await new Promise(resolve => showPrompt({ resolve }));
  if (granted) {
    AsyncStorage.setItem(PHOTO_ACCESS_KEY, 'true').catch(() => {});
    // Let the sheet's zoom-out finish before the system picker opens over it.
    await new Promise(r => setTimeout(r, 200));
  }
  return granted;
};

/** Drop-in for launchImageLibrary(IMAGE_PICKER_OPTIONS), gated by the consent prompt. */
export const pickImage = async () => {
  if (!(await ensurePhotoAccess())) return { didCancel: true };
  return launchImageLibrary(IMAGE_PICKER_OPTIONS);
};

export const useImagePicker = (onImageSelected) => {
  const [selectedImage, setSelectedImage] = useState(null);

  const selectImage = async () => {
    const response = await pickImage();

    if (response.assets?.[0]) {
      const localUri = response.assets[0].uri;
      setSelectedImage(localUri);
      onImageSelected?.(localUri);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    onImageSelected?.('');
  };

  return { selectedImage, selectImage, clearImage };
};
