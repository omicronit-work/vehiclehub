import firestore from '@react-native-firebase/firestore';

export const fetchUserByEmail = async (email) => {
  const doc = await firestore()
    .collection('users')
    .doc(email)
    .get();

  if (doc.exists) {
    return doc.data();
  } else {
    return null;
  }
};

export const fetchVehicleByEmail = async (email) => {
  const snapshot = await firestore()
    .collection('users')
    .doc(email)
    .collection('vehicles')
    .get();

  if (!snapshot.empty) {
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } else {
    return [];
  }
};

export const fetchServicesByid = async (email, id) => {
  console.log('vehicle id:', id);

  const snapshot = await firestore()
    .collection('users')
    .doc(email)
    .collection('vehicles')
    .doc(id)
    .collection('services')
    .get();

  if (!snapshot.empty) {
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } else {
    return [];
  }
};


export const fetchDocumentssByid = async (email, id) => {
  console.log('vehicle id:', id);

  const snapshot = await firestore()
    .collection('users')
    .doc(email)
    .collection('vehicles')
    .doc(id)
    .collection('documents')
    .get();

  if (!snapshot.empty) {
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } else {
    return [];
  }
};