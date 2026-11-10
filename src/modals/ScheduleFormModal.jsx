import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Modal from 'react-native-modal';
import { ScheduleFormSheet } from '../screens/schedule/ScheduleFormScreen';

/**
 * Add / edit schedule as a modal over the current screen (Home), instead of
 * pushing the ScheduleForm route. The sheet stays mounted until the close
 * animation finishes, and remounts fresh on every open.
 */
const ScheduleFormModal = ({ visible, vehicleId, ruleId, onClose, onSaved }) => {
  const [mounted, setMounted] = useState(visible);
  const [openCount, setOpenCount] = useState(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setOpenCount(n => n + 1);
    }
  }, [visible]);

  return (
    <Modal
      isVisible={visible}
      statusBarTranslucent
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      onModalHide={() => setMounted(false)}
      style={styles.modal}
      coverScreen
      useNativeDriver={false}
      backdropTransitionOutTiming={1}
      hideModalContentWhileAnimating
      backdropOpacity={0.55}
      animationIn="slideInUp"
      animationOut="slideOutDown"
    >
      {mounted && !!vehicleId && (
        <ScheduleFormSheet
          key={openCount}
          vehicleId={vehicleId}
          ruleId={ruleId}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
};

export default ScheduleFormModal;

const styles = StyleSheet.create({
  modal: { margin: 0, justifyContent: 'flex-end' },
});
