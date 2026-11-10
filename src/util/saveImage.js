import ImageSaver from '../../specs/NativeImageSaver';

const blobToDataUrl = blob =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

// Saves a remote image to the phone. Android 10+ writes straight into the
// gallery (Pictures/VehicleHub) with no permission; anywhere else the share
// sheet opens so the user can pick where it goes.
// Resolves to 'saved' or 'shared'.
export const saveImage = async (url, fileName = `VehicleHub_${Date.now()}`) => {
  if (!url) throw new Error('No image to save');

  if (ImageSaver) {
    try {
      await ImageSaver.saveImage(url, fileName);
      return 'saved';
    } catch (error) {
      if (error?.code !== 'UNSUPPORTED') throw error;
    }
  }

  // Required lazily: a TurboModule resolved with getEnforcing.
  const Share = require('react-native-share').default;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (HTTP ${response.status})`);
  const blob = await response.blob();
  const type = blob.type?.startsWith('image/') ? blob.type : 'image/jpeg';
  const dataUrl = await blobToDataUrl(blob);

  // failOnCancel: false — Android's chooser reports RESULT_CANCELED even
  // after a successful share.
  await Share.open({
    url: dataUrl.replace(/^data:[^;]*;/, `data:${type};`),
    type,
    filename: fileName,
    useInternalStorage: true,
    failOnCancel: false,
  });
  return 'shared';
};
