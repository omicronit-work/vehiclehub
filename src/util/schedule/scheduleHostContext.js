import { createContext, useContext } from 'react';

// Set by ScheduleHost (the Garage tab's vehicle detail). When present,
// schedule pages open inside that screen instead of on the root stack, and
// ScreenShell draws its embedded layout. `navigate(name, params)` accepts the
// stack route names: ScheduleDetail, ScheduleMarkDone, ServiceAlerts,
// ScheduleForm (opens the form modal).
export const ScheduleHostContext = createContext(null);
export const useScheduleHost = () => useContext(ScheduleHostContext);
