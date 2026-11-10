import { formatKm, kmToField, fieldToKm, formatEff, costPerUnit, effUnitLabel } from '../src/util/distance';
import { getMileageStatus } from '../src/util/mileageStatus';
import { fuelBadge } from '../src/util/fuelEfficiency';

describe('distance display', () => {
  it('formats km with separators, and converts to miles', () => {
    expect(formatKm(1500)).toBe('1,500 km');
    expect(formatKm(1500, 'mi')).toBe('932 mi');
    expect(formatKm('')).toBe('');
  });

  it('keeps typed miles stable through the km round trip', () => {
    // Inputs show kmToField(state) and store fieldToKm(typed): every whole
    // number of miles must come back exactly as typed.
    for (let mi = 0; mi <= 20000; mi += 1) {
      expect(kmToField(fieldToKm(String(mi), 'mi'), 'mi')).toBe(String(mi));
    }
  });

  it('is a no-op in km', () => {
    expect(fieldToKm('12a34', 'km')).toBe('1234');
    expect(kmToField('1234', 'km')).toBe('1234');
    expect(fieldToKm('', 'mi')).toBe('');
  });

  it('converts economy and cost per distance', () => {
    expect(formatEff(26.7, 'km/L', 'mi')).toBe('16.6 mi/L');
    expect(effUnitLabel('km/kWh', 'mi')).toBe('mi/kWh');
    expect(costPerUnit(6.19, 'mi')).toBeCloseTo(9.96, 2);
    expect(fuelBadge({ efficiency: 26.7, fuelType: 'Petrol' }, 'mi')).toBe('16.6 mi/L');
  });

  it('labels mileage chips in the chosen unit', () => {
    expect(getMileageStatus(7550, 1500, 'mi').label).toBe('Due in ~3,759 mi');
    expect(getMileageStatus(7550, 1500).label).toBe('Due in ~6,050 km');
  });
});
