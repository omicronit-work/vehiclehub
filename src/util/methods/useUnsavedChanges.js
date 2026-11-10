import React, { useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import ConfirmDeleteModal from '../../modals/ConfirmDeleteModal';
import WarningIcon from '../../assets/svg/WarningIcon';

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

/**
 * Returns [requestClose, dialog]. requestClose runs `discard` straight away
 * when clean, otherwise asks first. Render `dialog` inside the sheet's Modal
 * so it stacks above it.
 */
export const useDiscardConfirm = (dirty, discard) => {
  const [asking, setAsking] = useState(false);

  const requestClose = () => {
    if (!dirty) {
      discard();
      return;
    }
    Keyboard.dismiss();
    setAsking(true);
  };

  const dialog = React.createElement(ConfirmDeleteModal, {
    visible: asking,
    title: 'Discard changes?',
    description: "What you've entered won't be saved.",
    confirmLabel: 'Discard',
    cancelLabel: 'Keep editing',
    Icon: WarningIcon,
    onCancel: () => setAsking(false),
    onConfirm: () => {
      setAsking(false);
      discard();
    },
  });

  return [requestClose, dialog];
};
