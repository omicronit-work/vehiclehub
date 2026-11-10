import { useEffect, useMemo, useState } from 'react';
import { fetchFuelLogsById } from '../../store/fetchSlice.js';
import { toMillis } from '../dateStatus.js';
import { recordCurrency } from './useCurrency.js';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// The vehicle's other fill-ups, for the add/edit fuel forms: the previous
// fill-up before `date`, the km driven since it, and whether the typed
// odometer is lower than a reading already logged by then (likely a typo —
// flagged, not blocked, since backdated entries are valid).
// `excludeId` leaves out the log being edited. `lastPrice` is the most recent
// price per unit paid for `fuelType` (in `lastPriceCurrency`), for buying by amount.
export const useFuelHistory = ({ open, userEmail, carId, date, odometer, excludeId, vehicleOdometer, fuelType }) => {
  const [logs, setLogs] = useState([]);
  // True until this vehicle's logs arrive, so the form can hold space for the
  // previous fill-up card instead of jumping when it appears.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !userEmail || !carId) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    fetchFuelLogsById(userEmail, carId)
      .then(list => {
        if (!cancelled) setLogs((list || []).filter(l => l.id !== excludeId));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, userEmail, carId, excludeId]);

  return useMemo(() => {
    const at = date?.getTime?.() ?? Infinity;
    const before = logs
      .map(l => ({ ...l, ms: toMillis(l.date), km: Number(l.odometer) || 0 }))
      .filter(l => l.ms && l.ms <= at)
      .sort((a, b) => b.ms - a.ms || b.km - a.km);

    const previous = before[0] || null;
    const enteredKm = Number(odometer) || 0;

    let floorKm = before.reduce((max, l) => Math.max(max, l.km), 0);
    let floorMs = before.find(l => l.km === floorKm)?.ms ?? null;
    // The car's own odometer has no date; it only applies to today's entries.
    if (at >= startOfToday() && Number(vehicleOdometer) > floorKm) {
      floorKm = Number(vehicleOdometer);
      floorMs = null;
    }

    const lastPriced = logs
      .filter(l => l.fuelType === fuelType && Number(l.pricePerLiter) > 0)
      .sort((a, b) => (toMillis(b.date) || 0) - (toMillis(a.date) || 0))[0];
    const lastPrice = lastPriced?.pricePerLiter ?? null;

    // The fuel type of the most recent fill-up, to pre-select on a new one.
    const lastFuelType = [...logs]
      .sort((a, b) => (toMillis(b.date) || 0) - (toMillis(a.date) || 0))[0]?.fuelType ?? null;

    return {
      loading,
      previous,
      lastFuelType,
      lastPrice: lastPrice != null ? Number(lastPrice) : null,
      // The currency lastPrice was saved in (older logs: the base currency).
      lastPriceCurrency: lastPriced ? recordCurrency(lastPriced) : null,
      sinceKm: previous && enteredKm > previous.km ? enteredKm - previous.km : null,
      tooLow: enteredKm > 0 && floorKm > 0 && enteredKm < floorKm ? { km: floorKm, ms: floorMs } : null,
    };
  }, [logs, loading, date, odometer, vehicleOdometer, fuelType]);
};
