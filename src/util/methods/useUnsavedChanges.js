import { useRef } from 'react';
import { Alert, Keyboard } from 'react-native';

/**
 * True when `snapshot` (the sheet's editable state) differs from its clean
 * baseline. The baseline is the snapshot from the first render, re-taken
 * whenever `cleanKey` changes — edit sheets bump it in the same effect that
 * prefills the form, so the prefilled values count as clean.
 */
export const useUnsavedChanges = (snapshot, cleanKey) => {
  const json = JSON.stringify(snapshot);
  const baseline = useRef(json);
  const lastKey = useRef(cleanKey);
  if (lastKey.current !== cleanKey) {
    lastKey.current = cleanKey;
    baseline.current = json;
  }
  return json !== baseline.current;
};

/** Runs `discard` straight away when clean, otherwise asks first. */
export const confirmDiscard = (dirty, discard) => {
  if (!dirty) {
    discard();
    return;
  }
  Keyboard.dismiss();
  Alert.alert('Discard changes?', "What you've entered won't be saved.", [
    { text: 'Keep editing', style: 'cancel' },
    { text: 'Discard', style: 'destructive', onPress: discard },
  ]);
};
