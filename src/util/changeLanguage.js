import { getLanguage, setLanguage } from '../i18n';
import { saveUserLanguage } from '../store/userSlice';
import { rescheduleAllReminders, resyncScheduleReminders } from './reminderSync';
import { EVENTS, setUserProps, track } from './analytics';

/**
 * Switches the app to `code` (remounting it in that language, see App.jsx)
 * and, for a signed-in user, saves it to the account so it follows them to
 * another phone. `save: false` when the code just came from the account.
 */
export const changeLanguage = async (code, email, { save = true } = {}) => {
  const changed = code !== getLanguage();
  await setLanguage(code);
  if (save && email) saveUserLanguage(email, code).catch(e => console.warn('Saving language to account failed', e));
  if (!changed) return;
  // Scheduled notifications hold their text, so rebuild them in the new
  // language (silent: never asks for permission).
  if (email) {
    rescheduleAllReminders(email).catch(() => {});
    resyncScheduleReminders(email).catch(() => {});
  }
  track(EVENTS.LANGUAGE_CHANGED, { language: code });
  setUserProps({ app_language: code });
};
