import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { ScheduleHostContext } from '../../util/schedule/scheduleHostContext';
import ScheduleDetailScreen from '../../screens/schedule/ScheduleDetailScreen';
import DocumentDetailScreen from '../../screens/schedule/DocumentDetailScreen';
import MarkDoneScreen from '../../screens/schedule/MarkDoneScreen';
import ServiceAlertsScreen from '../../screens/schedule/ServiceAlertsScreen';
import ScheduleFormModal from '../../modals/ScheduleFormModal';
import BackupScreen from '../../screens/BackupScreen';

const SCREENS = {
  ScheduleDetail: ScheduleDetailScreen,
  DocumentDetail: DocumentDetailScreen,
  ScheduleMarkDone: MarkDoneScreen,
  ServiceAlerts: ServiceAlertsScreen,
  // Settings → Backup and export
  Backup: BackupScreen,
};

/**
 * Keeps the schedule pages inside the screen that hosts it (Home, Vehicle): a card, "Service alerts
 * settings" or "Mark as done" replace `children` (the vehicle detail, kept
 * mounted so its tab and scroll survive) with that page, and the add / edit
 * form opens as a modal over it. Back pops one page at a time.
 */
// `pageStyle` pads the page for hosts whose content pads itself (Home).
const ScheduleHost = ({ children, pageStyle }) => {
  const [stack, setStack] = useState([]);
  const [form, setForm] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const goBack = useCallback(() => setStack(s => s.slice(0, -1)), []);

  const navigate = useCallback((name, params = {}) => {
    if (name === 'ScheduleForm') {
      setForm(params);
      setFormOpen(true);
      return;
    }
    if (SCREENS[name]) setStack(s => [...s, { name, params }]);
  }, []);

  const host = useMemo(() => ({ navigate, goBack }), [navigate, goBack]);

  const top = stack[stack.length - 1];
  const isFocused = useIsFocused();

  // Android back closes the open schedule page first — only in the tab on
  // screen, since Home and Vehicle can each have a page open.
  useEffect(() => {
    if (!top || !isFocused) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [top, isFocused, goBack]);

  const Screen = top && SCREENS[top.name];

  return (
    <ScheduleHostContext.Provider value={host}>
      <View style={[styles.flex, top && styles.hidden]}>{children}</View>
      {Screen && (
        <View style={[styles.flex, pageStyle]}>
          <Screen key={stack.length} navigation={host} route={{ params: top.params }} />
        </View>
      )}
      <ScheduleFormModal
        visible={formOpen}
        vehicleId={form?.vehicleId}
        ruleId={form?.ruleId}
        onClose={() => setFormOpen(false)}
        onSaved={form?.onSaved}
      />
    </ScheduleHostContext.Provider>
  );
};

export default ScheduleHost;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hidden: { display: 'none' },
});
