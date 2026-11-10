import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { loadVehicleScheduleData } from './scheduleStore';
import { compareEvaluations, countStatuses, evaluateRule, todayYmd } from './scheduleMath';

// Last loaded schedule data per `${email}|${vehicleId}`, kept for the
// session. Screens that use this hook are rebuilt on every tab visit; with
// this they show the vehicle's schedules at once and refresh them quietly,
// instead of starting empty and waiting on the network each time.
const scheduleCache = new Map();
const cacheKey = (email, vehicleId) => `${email}|${vehicleId}`;

/**
 * One vehicle's schedule rules, evaluated for today, reloaded every time the
 * screen using it gains focus (so a reading saved elsewhere shows at once).
 */
export const useVehicleSchedules = vehicleId => {
  const userEmail = useSelector(state => state.user.userEmail);
  const recordsVersion = useSelector(state => state.user.recordsVersion);
  const [data, setData] = useState(() => scheduleCache.get(cacheKey(userEmail, vehicleId)) || null);
  const [loading, setLoading] = useState(() => !data);
  const [error, setError] = useState(false);
  const loadedFor = useRef(data ? vehicleId : null);
  // Only the newest request may update state. Without this, switching vehicles
  // quickly let a slower load for the previous vehicle land last, so a
  // vehicle showed another vehicle's (often empty) list and its schedules
  // looked like they had disappeared.
  const requestSeq = useRef(0);

  const reload = useCallback(async () => {
    const seq = ++requestSeq.current;
    if (!userEmail || !vehicleId) {
      setLoading(false);
      return null;
    }
    if (loadedFor.current !== vehicleId) {
      // Switched to a vehicle seen earlier this session: show its schedules
      // now; the fetch below refreshes them.
      const cached = scheduleCache.get(cacheKey(userEmail, vehicleId));
      if (cached) {
        setData(cached);
        loadedFor.current = vehicleId;
      } else {
        setLoading(true);
      }
    }
    try {
      const next = await loadVehicleScheduleData(userEmail, vehicleId);
      const fresh = { ...next, vehicleId };
      scheduleCache.set(cacheKey(userEmail, vehicleId), fresh);
      if (seq !== requestSeq.current) return next;
      setData(fresh);
      setError(false);
      loadedFor.current = vehicleId;
      return next;
    } catch (e) {
      console.log('Schedule load failed:', e);
      if (seq === requestSeq.current) setError(true);
      return null;
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [userEmail, vehicleId]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // A save made in a modal or an in-screen page (no focus change) reloads too.
  const seenVersion = useRef(recordsVersion);
  useEffect(() => {
    if (seenVersion.current === recordsVersion) return;
    seenVersion.current = recordsVersion;
    reload();
  }, [recordsVersion, reload]);

  // Never hand out another vehicle's data while this one loads.
  const current = data && data.vehicleId === vehicleId ? data : null;

  const evaluations = useMemo(() => {
    const data = current;
    if (!data) return [];
    const today = todayYmd();
    return data.schedules
      .map(rule => evaluateRule(rule, { today, odometer: data.odometer }))
      .sort(compareEvaluations);
  }, [current]);

  const counts = useMemo(() => countStatuses(evaluations), [evaluations]);

  return { userEmail, data: current, evaluations, counts, loading: loading || (!current && !error && !!vehicleId && !!userEmail), error, reload };
};
