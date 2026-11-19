import { getLanguage, savedLanguage } from '../../i18n';
import { LANGUAGE_CODES } from '../../i18n/languages';
import { changeLanguage } from '../../util/changeLanguage';
import { findCountry, getSelectedCountry, setSelectedCountry } from '../../util/countries';
import { findCurrency } from '../../util/currencies';
import {
  applyAccountCurrency,
  isManualCurrency,
  savedOrDefaultCurrency,
  setManualCurrency,
} from '../../util/methods/useCurrency';
import {
  getUserCountry,
  getUserCurrency,
  getUserLanguage,
  saveUserCountry,
  saveUserCurrency,
  saveUserLanguage,
} from '../../store/userSlice';

/*
 * First-run setup: language, country and currency, asked in one sheet
 * (SetupSheet). Before sign-in each is asked only when this phone has none;
 * after sign-in the account's saved value wins, then a choice made before
 * sign-in (`launch`), then the phone's own, and only when none exists is the
 * user asked. Whatever is already known is applied here without asking.
 */

export const STEPS = ['language', 'country', 'currency'];

// Each check resolves to true when the setting is settled (nothing to ask).
// A check that fails (offline, profile unreadable) also counts as settled:
// the user isn't asked now, and it is checked again on the next start.
const settle = async check => {
  try {
    return await check();
  } catch (e) {
    console.warn('Setup check failed', e);
    return true;
  }
};

const languageSettled = ({ email, beforeSignIn, launch }) => settle(async () => {
  if (beforeSignIn) return !!(await savedLanguage());
  if (launch.language && LANGUAGE_CODES.includes(launch.language)) {
    await changeLanguage(launch.language, email);
    return true;
  }
  const code = await getUserLanguage(email);
  if (code && LANGUAGE_CODES.includes(code)) {
    await changeLanguage(code, email, { save: false });
    return true;
  }
  // Chosen on this phone before the account kept it: keep that, no question.
  const local = await savedLanguage();
  if (local) {
    await saveUserLanguage(email, local);
    return true;
  }
  return false;
});

const countrySettled = ({ email, beforeSignIn, launch }) => settle(async () => {
  if (beforeSignIn) return !!(await getSelectedCountry());
  if (launch.country && findCountry(launch.country)) {
    if (await setSelectedCountry(launch.country)) await saveUserCountry(email, launch.country);
    return true;
  }
  const code = await getUserCountry(email);
  if (code && (await setSelectedCountry(code))) return true;
  const local = await getSelectedCountry();
  if (local) {
    await saveUserCountry(email, local);
    return true;
  }
  return false;
});

const currencySettled = ({ email, beforeSignIn, launch }) => settle(async () => {
  if (beforeSignIn) return isManualCurrency();
  const chosen = findCurrency(launch.currency);
  if (chosen) {
    await setManualCurrency(chosen);
    await saveUserCurrency(email, chosen.code);
    return true;
  }
  // Saved on the account: use it on this phone too, no question.
  const code = await getUserCurrency(email);
  if (code && (await applyAccountCurrency(code))) return true;
  if (await isManualCurrency()) {
    const local = await savedOrDefaultCurrency();
    if (findCurrency(local?.code)) {
      await saveUserCurrency(email, local.code);
      return true;
    }
  }
  return false;
});

/**
 * Applies everything already known and resolves to the steps still to ask,
 * in order (possibly none). `email` is required unless `beforeSignIn`.
 */
export const planSetup = async ({ email, beforeSignIn = false, launch = {} }) => {
  const ctx = { email, beforeSignIn, launch };
  const steps = [];
  if (!(await languageSettled(ctx))) steps.push('language');
  if (!(await countrySettled(ctx))) steps.push('country');
  if (!(await currencySettled(ctx))) steps.push('currency');
  return steps;
};

/** The language pre-picked on the language step: the one the app is showing. */
export const initialLanguage = () => getLanguage();

/**
 * A language tapped on the language step is used at once, so the rest of the
 * sheet reads in it. Signed in, it is also saved to the account.
 */
export const applyLanguage = (code, { email, beforeSignIn }) =>
  changeLanguage(code, beforeSignIn ? undefined : email).catch(e => console.warn('Changing language failed', e));

/**
 * Saves the country and currency picked in the sheet (the language was
 * already applied when tapped). Signed in, they go to the account too.
 */
export const saveSetup = async ({ email, beforeSignIn }, { country, currency }) => {
  const account = !beforeSignIn && email;
  try {
    if (country) {
      await setSelectedCountry(country);
      if (account) await saveUserCountry(email, country);
    }
    const item = findCurrency(currency);
    if (item) {
      await setManualCurrency(item);
      if (account) await saveUserCurrency(email, item.code);
    }
  } catch (e) {
    console.warn('Saving setup failed', e);
  }
};
