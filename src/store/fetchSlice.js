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


export const fetchServicesFromFirestore = async () => {
  try {
    const doc = await firestore()
      .collection('service')
      .doc('service_list')
      .get();

    if (!doc.exists) {
      console.log('No service data found');
      return [];
    }

    const data = doc.data();

    // Ensure safe fallback
    const services = data?.services || [];

    // Optional: normalize structure
    const formattedServices = services.map(item => ({
      id: item.id,
      name: item.name,
      extraFields: item.extraFields || [],
    }));

    return formattedServices;
  } catch (error) {
    console.error('Error fetching services:', error);
    return [];
  }
};