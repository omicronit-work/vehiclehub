import { useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';

const requestPermission = async () => {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
};

export const useImagePicker = (onImageSelected) => {
  const [selectedImage, setSelectedImage] = useState(null);

  const selectImage = async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    const response = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });

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
