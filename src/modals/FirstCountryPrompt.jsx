import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import CountryPickerSheet from './CountryPickerSheet';
import { setSelectedCountry } from '../util/countries';
import { getUserCountry, saveUserCountry } from '../store/userSlice';

/**
 * On every sign-in and app start, checks the account's country in the
 * database: when it has one, it is used on this phone without asking; when
 * it has none, the user picks one of the 20 countries (can't be dismissed).
 * `onDone(email)` runs once the country is settled for that account (or the
 * check failed), so the currency prompt can follow without two pop-ups
 * showing at once. Mounted in App.jsx.
 */
const FirstCountryPrompt = ({ ready, onDone }) => {
  const userEmail = useSelector(state => state.user.userEmail);
  const [visible, setVisible] = useState(false);
  const pendingDone = useRef(null);

  useEffect(() => {
    if (!ready || !userEmail) {
      setVisible(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const code = await getUserCountry(userEmail);
        if (cancelled) return;
        if (code && (await setSelectedCountry(code))) {
          onDone?.(userEmail);
          return;
        }
        if (!cancelled) setVisible(true);
      } catch (e) {
        // Profile unreadable (offline, nothing cached): ask again next start.
        console.warn('Country check failed', e);
        if (!cancelled) onDone?.(userEmail);
      }
    })();
    return () => { cancelled = true; };
    // onDone is a fresh function each render; the check only depends on these.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, userEmail]);

  const confirm = country => {
    pendingDone.current = userEmail;
    setVisible(false);
    setSelectedCountry(country.code).catch(e => console.warn('Saving country failed', e));
    saveUserCountry(userEmail, country.code).catch(e => console.warn('Saving country to account failed', e));
  };

  // Tell the parent only after the sheet has gone, so the next pop-up opens cleanly.
  const handleHidden = () => {
    const email = pendingDone.current;
    pendingDone.current = null;
    if (email) onDone?.(email);
  };

  return <CountryPickerSheet visible={visible} onConfirm={confirm} onHidden={handleHidden} />;
};

export default FirstCountryPrompt;
