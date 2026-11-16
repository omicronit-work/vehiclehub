import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import SetupSheet from './SetupSheet';
import { applyLanguage, initialLanguage, planSetup, saveSetup } from './setupSteps';

/**
 * First-run language → country → currency, in one sheet (SetupSheet).
 * Mounted twice in App.jsx:
 *   beforeSignIn  on a fresh start, for whatever this phone doesn't know yet.
 *                 `onDone({ language, country, currency })` hands back what
 *                 was picked, so it can be saved to the account at sign-in.
 *   (signed in)   on every sign-in and app start, for the account. `launch`
 *                 is what was picked before sign-in; it is used without
 *                 asking again. `onDone()` once all three are settled.
 * Settings already known are applied without asking; only the rest show,
 * and nothing shows when all three are known.
 */
const SetupPrompt = ({ ready, beforeSignIn = false, launch, onDone }) => {
  const userEmail = useSelector(state => state.user.userEmail);
  const email = beforeSignIn ? null : userEmail;
  const [visible, setVisible] = useState(false);
  const [steps, setSteps] = useState([]);
  const [initial, setInitial] = useState(null);
  const pending = useRef(null); // picks waiting for the sheet to close
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const launchRef = useRef(launch);
  launchRef.current = launch;
  // Once per launch before sign-in; once per account when signed in.
  const doneFor = useRef(undefined);

  const active = ready && (beforeSignIn || !!email);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      if (!beforeSignIn && !email) doneFor.current = undefined; // signed out: check the next account
      return undefined;
    }
    const key = email || 'device';
    if (doneFor.current === key) return undefined;
    let cancelled = false;
    (async () => {
      const ask = await planSetup({ email, beforeSignIn, launch: launchRef.current || {} });
      if (cancelled) return;
      doneFor.current = key;
      if (!ask.length) {
        onDoneRef.current?.({});
        return;
      }
      setSteps(ask);
      setInitial({ language: initialLanguage() });
      setVisible(true);
    })();
    return () => { cancelled = true; };
  }, [active, email, beforeSignIn]);

  const finish = picks => {
    const chosen = Object.fromEntries(steps.map(s => [s, picks[s]]));
    pending.current = {
      chosen,
      // A tapped language is already in use; this also keeps the pre-picked
      // one when it was confirmed without a tap. Country and currency are
      // saved now so they're in place when the sheet has gone.
      saved: Promise.all([
        chosen.language ? applyLanguage(chosen.language, { email, beforeSignIn }) : null,
        saveSetup({ email, beforeSignIn }, chosen),
      ]),
    };
    setVisible(false);
  };

  const handleHidden = async () => {
    const job = pending.current;
    pending.current = null;
    if (!job) return;
    await job.saved;
    onDoneRef.current?.(job.chosen);
  };

  return (
    <SetupSheet
      visible={visible}
      steps={steps}
      initial={initial}
      onLanguage={code => applyLanguage(code, { email, beforeSignIn })}
      onFinish={finish}
      onHidden={handleHidden}
    />
  );
};

export default SetupPrompt;
