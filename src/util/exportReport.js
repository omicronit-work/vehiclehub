import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchServicesByid, fetchDocumentssByid, fetchFuelLogsById } from '../store/fetchSlice.js';
import { toMillis, getServiceStatus, getDocumentStatus } from './dateStatus.js';
import { fuelUnit } from './fuelEfficiency.js';
import { getRate, BASE_CURRENCY } from './fx.js';
import { accent } from '../theme/accent';

export const EXPORT_SECTIONS = ['services', 'fuel', 'documents'];

// Service extra fields as stored by addUserService/updateUserService → label.
const EXTRA_FIELD_LABELS = {
  oilType: 'Oil type',
  oilQuantity: 'Oil quantity',
  filterBrand: 'Filter brand',
  tireBrand: 'Tire brand',
  tireSize: 'Tire size',
  quantity: 'Quantity',
  padBrand: 'Pad brand',
  frontOrRear: 'Front/Rear',
  servicePackage: 'Package',
};

// ─── Formatting helpers ──────────────────────────────────────────────────────

const byDateDesc = key => (a, b) => (toMillis(b[key]) ?? 0) - (toMillis(a[key]) ?? 0);

const formatDate = value => {
  const ms = toMillis(value);
  if (ms === null) return '';
  return new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ISO (YYYY-MM-DD) for the file name, so exports sort by date.
const isoDate = value => {
  const ms = toMillis(value);
  if (ms === null) return '';
  const d = new Date(ms);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const round2 = n => Math.round(n * 100) / 100;

const formatMoney = (n, symbol) =>
  `${symbol} ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const formatNumber = n => (n ? Number(n).toLocaleString() : '');

const extraDetails = service =>
  Object.entries(EXTRA_FIELD_LABELS)
    .filter(([key]) => service[key])
    .map(([key, label]) => `${label}: ${service[key]}`)
    .join(' · ');

const vehicleTitle = vehicle =>
  [vehicle?.brand, vehicle?.model, vehicle?.year].filter(Boolean).join(' ') || 'Vehicle';

const safeFileName = vehicle => {
  const stamp = isoDate(new Date());
  const base = vehicleTitle(vehicle).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  return `${base || 'Vehicle'}_Service_History_${stamp}`;
};

// ─── Data ────────────────────────────────────────────────────────────────────

// Costs are stored in BASE_CURRENCY; export them in the user's chosen currency
// the same way Dashboard/VehicleInformations display them. If the rate can't
// be fetched, fall back to the base currency (labelled as such) rather than
// silently mixing units.
const loadCurrency = async () => {
  let code = BASE_CURRENCY;
  let symbol = '৳';
  try {
    const saved = JSON.parse((await AsyncStorage.getItem('selectedCurrency')) || 'null');
    if (saved?.code) {
      code = saved.code;
      symbol = saved.symbol || saved.code;
    }
  } catch (_) {}

  try {
    const rate = await getRate(BASE_CURRENCY, code);
    return { code, symbol, rate };
  } catch (e) {
    console.warn('FX rate unavailable, exporting in base currency', e);
    return { code: BASE_CURRENCY, symbol: '৳', rate: 1 };
  }
};

const loadReportData = async (email, vehicle, sections) => {
  const want = s => sections.includes(s);
  const [services, fuelLogs, documents, currency] = await Promise.all([
    want('services') ? fetchServicesByid(email, vehicle.id) : [],
    want('fuel') ? fetchFuelLogsById(email, vehicle.id) : [],
    want('documents') ? fetchDocumentssByid(email, vehicle.id) : [],
    loadCurrency(),
  ]);

  const convert = v => round2((Number(v) || 0) * currency.rate);

  return {
    vehicle,
    currency,
    services: services.sort(byDateDesc('serviceDate')).map(s => ({ ...s, cost: convert(s.totalCost) })),
    fuelLogs: fuelLogs.sort(byDateDesc('date')).map(f => ({
      ...f,
      cost: convert(f.totalCost),
      unitPrice: convert(f.pricePerLiter),
    })),
    documents: documents.sort(byDateDesc('expiryDate')),
    sections,
  };
};

const totals = data => {
  const serviceSpend = data.services.reduce((sum, s) => sum + s.cost, 0);
  const fuelSpend = data.fuelLogs.reduce((sum, f) => sum + f.cost, 0);
  return { serviceSpend: round2(serviceSpend), fuelSpend: round2(fuelSpend), total: round2(serviceSpend + fuelSpend) };
};

// ─── PDF (HTML) ──────────────────────────────────────────────────────────────

const esc = value =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const TONE_COLORS = { danger: '#E5484D', warning: '#B7791F', success: '#2BAA6D', neutral: '#64748B' };

const statusPill = ({ label, tone }) =>
  `<span class="pill" style="color:${TONE_COLORS[tone] || TONE_COLORS.neutral}">${esc(label)}</span>`;

const emptyRow = (cols, text) => `<tr><td colspan="${cols}" class="empty">${esc(text)}</td></tr>`;

export const buildHtml = data => {
  const { symbol } = data.currency;
  const t = totals(data);
  const has = s => data.sections.includes(s);

  const tiles = [
    has('services') && ['Services', data.services.length, formatMoney(t.serviceSpend, symbol)],
    has('fuel') && ['Fuel logs', data.fuelLogs.length, formatMoney(t.fuelSpend, symbol)],
    has('documents') && ['Documents', data.documents.length, ''],
    (has('services') || has('fuel')) && ['Total spend', '', formatMoney(t.total, symbol)],
  ].filter(Boolean);

  const servicesTable = !has('services') ? '' : `
    <h2>Service history</h2>
    <table>
      <thead><tr>
        <th>Date</th><th>Service</th><th>Workshop</th><th class="num">Mileage</th>
        <th class="num">Cost</th><th>Next due</th>
      </tr></thead>
      <tbody>
      ${data.services.length === 0 ? emptyRow(6, 'No services recorded') : data.services.map(s => {
        const details = [extraDetails(s), s.description].filter(Boolean).join(' — ');
        const nextDue = [formatDate(s.nextServiceDate), s.nextServiceMileage ? `${formatNumber(s.nextServiceMileage)} km` : '']
          .filter(Boolean).join('<br/>');
        return `
          <tr>
            <td class="nowrap">${esc(formatDate(s.serviceDate)) || '—'}</td>
            <td><strong>${esc(s.name)}</strong>${details ? `<div class="sub">${esc(details)}</div>` : ''}</td>
            <td>${esc(s.workshopName) || '—'}</td>
            <td class="num">${s.currentMileage ? `${formatNumber(s.currentMileage)} km` : '—'}</td>
            <td class="num">${esc(formatMoney(s.cost, symbol))}</td>
            <td>${nextDue || '—'}${s.nextServiceDate ? `<div>${statusPill(getServiceStatus(s))}</div>` : ''}</td>
          </tr>`;
      }).join('')}
      </tbody>
    </table>`;

  const fuelTable = !has('fuel') ? '' : `
    <h2>Fuel logs</h2>
    <table>
      <thead><tr>
        <th>Date</th><th>Fuel</th><th class="num">Quantity</th><th class="num">Unit price</th>
        <th class="num">Total</th><th class="num">Odometer</th><th>Station</th>
      </tr></thead>
      <tbody>
      ${data.fuelLogs.length === 0 ? emptyRow(7, 'No fuel logs recorded') : data.fuelLogs.map(f => `
        <tr>
          <td class="nowrap">${esc(formatDate(f.date)) || '—'}</td>
          <td>${esc(f.fuelType)}${f.fullTank ? '<div class="sub">Full tank</div>' : ''}</td>
          <td class="num">${f.liters ? `${esc(f.liters)} ${fuelUnit(f.fuelType)}` : '—'}</td>
          <td class="num">${f.unitPrice ? esc(formatMoney(f.unitPrice, symbol)) : '—'}</td>
          <td class="num">${esc(formatMoney(f.cost, symbol))}</td>
          <td class="num">${f.odometer ? `${formatNumber(f.odometer)} km` : '—'}</td>
          <td>${esc(f.stationName) || '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;

  const documentsTable = !has('documents') ? '' : `
    <h2>Documents</h2>
    <table>
      <thead><tr><th>Document</th><th>Issued</th><th>Expires</th><th>Status</th></tr></thead>
      <tbody>
      ${data.documents.length === 0 ? emptyRow(4, 'No documents recorded') : data.documents.map(d => `
        <tr>
          <td><strong>${esc(d.documentName)}</strong>${d.description ? `<div class="sub">${esc(d.description)}</div>` : ''}</td>
          <td class="nowrap">${esc(formatDate(d.issueDate)) || '—'}</td>
          <td class="nowrap">${esc(formatDate(d.expiryDate)) || '—'}</td>
          <td>${statusPill(getDocumentStatus(d))}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; }
  /* The library's padding option is ignored by Android's WebView printer. */
  @page { margin: 32px 28px; }
  body { font-family: -apple-system, 'Roboto', 'Helvetica Neue', Arial, sans-serif; color: #0F172A; font-size: 10.5px; margin: 0; }
  .header { background: ${accent.primary}; color: #fff; border-radius: 10px; padding: 18px 20px; }
  .header .eyebrow { font-size: 10px; letter-spacing: 1.2px; text-transform: uppercase; opacity: .75; }
  .header h1 { font-size: 22px; margin: 4px 0 6px; }
  .header .meta { font-size: 10.5px; opacity: .85; }
  .tiles { display: flex; gap: 8px; margin: 14px 0 4px; }
  .tile { flex: 1; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 12px; background: #F8FAFC; }
  .tile .label { color: #64748B; font-size: 9.5px; text-transform: uppercase; letter-spacing: .6px; }
  .tile .count { font-size: 18px; font-weight: 700; margin-top: 2px; }
  .tile .amount { font-size: 11.5px; font-weight: 600; color: ${accent.primary}; margin-top: 2px; }
  h2 { font-size: 13px; color: ${accent.primary}; margin: 20px 0 8px; padding-bottom: 4px; border-bottom: 2px solid ${accent.tint}; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .5px; color: #64748B; background: #F1F5F9; padding: 6px 8px; }
  td { padding: 7px 8px; border-bottom: 1px solid #EEF1F5; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .nowrap { white-space: nowrap; }
  .sub { color: #64748B; font-size: 9.5px; margin-top: 2px; }
  .pill { font-size: 9px; font-weight: 600; }
  .empty { text-align: center; color: #94A3B8; padding: 14px; }
  .footer { margin-top: 24px; color: #94A3B8; font-size: 9px; text-align: center; }
</style></head>
<body>
  <div class="header">
    <div class="eyebrow">Vehicle Service Report</div>
    <h1>${esc(vehicleTitle(data.vehicle))}</h1>
    <div class="meta">
      ${data.vehicle.currentOdometer ? `Odometer: ${formatNumber(data.vehicle.currentOdometer)} km &nbsp;·&nbsp; ` : ''}
      Generated ${esc(formatDate(new Date()))} &nbsp;·&nbsp; Amounts in ${esc(data.currency.code)}
    </div>
  </div>
  <div class="tiles">
    ${tiles.map(([label, count, amount]) => `
      <div class="tile">
        <div class="label">${esc(label)}</div>
        ${count !== '' ? `<div class="count">${esc(count)}</div>` : ''}
        ${amount ? `<div class="amount">${esc(amount)}</div>` : ''}
      </div>`).join('')}
  </div>
  ${servicesTable}
  ${fuelTable}
  ${documentsTable}
  <div class="footer">Generated with VehicleHub</div>
</body></html>`;
};

// ─── Entry point ─────────────────────────────────────────────────────────────

/**
 * Builds the vehicle's PDF report and opens it straight in the device's PDF
 * viewer (Quick Look on iOS), whose own share button covers sending it on.
 * If no PDF viewer is installed, falls back to the system share sheet.
 */
export const exportVehicleReport = async ({ email, vehicle, sections = EXPORT_SECTIONS }) => {
  if (!email) throw new Error('email is missing or empty');
  if (!vehicle?.id) throw new Error('vehicle is missing or has no id');
  if (!sections.length) throw new Error('Select at least one section to export');

  // Required lazily: these are TurboModules resolved with getEnforcing, so a
  // top-level import would crash app startup (via the Vehicle screen import
  // chain) on any binary built without them, instead of failing just here.
  const { generatePDF } = require('react-native-html-to-pdf');
  const { viewDocument, errorCodes, isErrorWithCode } = require('@react-native-documents/viewer');
  const Share = require('react-native-share').default;

  const data = await loadReportData(email, vehicle, sections);
  const fileName = safeFileName(vehicle);
  const title = `${vehicleTitle(vehicle)} — Service History`;

  const pdf = await generatePDF({
    html: buildHtml(data),
    fileName,
    width: 595, // A4 in points
    height: 842,
    bgColor: '#FFFFFF',
    shouldPrintBackgrounds: true,
    // Android: without a directory the library uses File.createTempFile in the
    // cache dir, which appends a random number to the name the viewer shows.
    // With one it writes <externalFilesDir>/Exports/<fileName>.pdf exactly
    // (exposed to the viewer by android/app/src/main/res/xml/file_paths.xml).
    // iOS only accepts "Documents" here and already keeps the exact name in tmp.
    ...(Platform.OS === 'android' && { directory: 'Exports' }),
    base64: true, // for the share fallback below
  });

  const uri = pdf.filePath.startsWith('file://') ? pdf.filePath : `file://${pdf.filePath}`;
  try {
    await viewDocument({ uri, mimeType: 'application/pdf', headerTitle: title });
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.UNABLE_TO_OPEN_FILE_TYPE) {
      // Shared as a data URL: react-native-share's FileProvider can't reach
      // the external files dir the PDF was written to. Android appends the
      // extension from the MIME type itself; iOS uses the name as given.
      // useInternalStorage because that FileProvider only exposes the
      // internal cache dir. failOnCancel: false — Android's chooser reports
      // RESULT_CANCELED even after a successful share.
      await Share.open({
        title,
        url: `data:application/pdf;base64,${pdf.base64}`,
        type: 'application/pdf',
        filename: Platform.OS === 'ios' ? `${fileName}.pdf` : fileName,
        useInternalStorage: true,
        failOnCancel: false,
      });
      return;
    }
    throw error;
  }
};
