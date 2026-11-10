import { useEffect, useState } from 'react';

// How long a tab shows its skeleton on every visit, even when its data is
// already cached and would otherwise appear instantly.
export const VISIT_SKELETON_MS = 800;

// True for the first `ms` after the screen mounts. Tabs that rebuild on every
// visit from the tab bar (see RemountOnTabPress in StackNavigation) use it to
// play their skeleton each time the user comes in. Screens combine it with
// their real loading flag: `loading || visitSkeleton`.
export const useVisitSkeleton = (ms = VISIT_SKELETON_MS) => {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setActive(false), ms);
    return () => clearTimeout(timer);
  }, [ms]);

  return active;
};
