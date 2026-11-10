// Firestore applies every write to the on-device cache immediately; the
// promise returned by setDoc/updateDoc/deleteDoc only settles once the
// *server* acknowledges it. On a slow connection that took 10–35 s, and
// offline it never settles at all, so awaiting it froze every Save button.
//
// `commit` starts the write and returns straight away. Reads (getDocs/getDoc)
// already include pending local writes, so lists refresh with the new record,
// and the SDK uploads it in the background when the network is back.
export const commit = (writePromise, label = 'Firestore write') => {
  writePromise.catch(error => console.warn(`${label} failed:`, error));
};
