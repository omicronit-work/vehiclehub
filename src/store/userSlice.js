import { createSlice } from '@reduxjs/toolkit';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
const initialState = {
  name: '',
  email: '',
  photo: '',
  termCondition:'',
  
  userEmail:'',
  selectedCar:'',
  VehicalModal:false,
  Trigger:false
 
};


// SAVE USER
export const saveUserToFirestore = async (user) => {
  const { email, name, photo, termCondition } = user;

  await firestore()
    .collection('users')
    .doc(email)
    .set({
      name,
      email,
      photo,
      termCondition
    });
};


// ADD USER VEHICLE (with duplicate check)
export const addUserVehicle = async (email, vehicle) => {
  try {
    console.log('Email:::', email);

    // Check if vehicle with same brand & model already exists
    const existingVehicles = await firestore()
      .collection('users')
      .doc(email)
      .collection('vehicles')
      .where('brand', '==', vehicle.brand)
      .where('model', '==', vehicle.model)
      .get();

    if (!existingVehicles.empty) {
      console.log('Vehicle already exists!');
      return { success: false, message: 'Vehicle Already Exist' };
    }

    // Add new vehicle if no duplicate found
    await firestore()
  .collection('users')
  .doc(email)
  .collection('vehicles')
  .add({
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.year,
    imageUrl: vehicle.imageUrl || '',
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

    console.log('Vehicle added successfully!');
    return { success: true, message: 'Vehicle added successfully!' };

  } catch (error) {
    console.error('Error adding vehicle to Firestore:', error);
    throw error;
  }
};


// ADD SERVICE (subcollection)
export const addUserService = async (email, service, id) => {
  try {
    if (!id) {
      throw new Error('vehicleId (id) is missing or empty');
    }

    console.log('Vehicle ID:', id);
    console.log('Adding Service Data::', service);

    const data = {
      name: service.name,
      imageUrl: service.imageUrl || '',
      description: service.description,
      currentMileage: Number(service.currentMileage) || 0,
      totalCost: Number(service.totalCost) || 0,
      workshopName: service.workshopName,
      serviceDate: service.serviceDate ? new Date(service.serviceDate) : null,
      nextServiceDate: service.nextServiceDate ? new Date(service.nextServiceDate) : null,
      remindMe: !!service.remindMe,
      createdAt: firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await firestore()
      .collection('users')
      .doc(email)
      .collection('vehicles')
      .doc(id)
      .collection('services')
      .add(data);

    return docRef.id;
  } catch (error) {
    console.error('Error adding service:', error);
    throw error;
  }
};

// ADD DOCUMENT (second subcollection)
// ADD DOCUMENT (subcollection inside vehicle)
export const addUserDocument = async (email, document, id) => {
  try {
    if (!id) {
      throw new Error('vehicleId (id) is missing or empty');
    }

    console.log('Vehicle ID:', id);
    console.log('Adding Document Data::', document);

    const data = {
      documentName: document.documentName,
      description: document.description || '',
      issueDate: document.issueDate
        ? new Date(document.issueDate)
        : null,
      expiryDate: document.expiryDate
        ? new Date(document.expiryDate)
        : null,
      remindMe: !!document.remindMe,
      imageUrl: document.imageUrl || '',
      file: document.file || null, // file url or object
      createdAt: firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await firestore()
      .collection('users')
      .doc(email)
      .collection('vehicles')
      .doc(id)
      .collection('documents')
      .add(data);

    return docRef.id;
  } catch (error) {
    console.error('Error adding document:', error);
    throw error;
  }
};

export const updateUserDocument = async (email, document, vehicleId, documentId) => {
  try {
    if (!vehicleId) {
      throw new Error('vehicleId (id) is missing or empty');
    }

    if (!documentId) {
      throw new Error('documentId is missing or empty');
    }

    console.log('Vehicle ID:', vehicleId);
    console.log('Document ID:', documentId);
    console.log('Updating Document Data::', document);

    const data = {
      documentName: document.documentName,
      description: document.description || '',
      issueDate: document.issueDate ? new Date(document.issueDate) : null,
      expiryDate: document.expiryDate ? new Date(document.expiryDate) : null,
      remindMe: !!document.remindMe,
      imageUrl: document.imageUrl || '',
      file: document.file || null,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };

    await firestore()
      .collection('users')
      .doc(email)
      .collection('vehicles')
      .doc(vehicleId)
      .collection('documents')
      .doc(documentId)
      .update(data);

    return documentId;
  } catch (error) {
    console.error('Error updating document:', error);
    throw error;
  }
};

export const updateUserService = async (email, dataSource, vehicleId, serviceId) => {
  try {
    if (!vehicleId) throw new Error('vehicleId (id) is missing or empty');
    if (!serviceId) throw new Error('serviceId is missing or empty');

    console.log('Vehicle ID:', vehicleId);
    console.log('Service ID:', serviceId);
    console.log('Updating Data:', dataSource);

    const data = {
      name: dataSource.name || '',                                        // matches addUserService
      description: dataSource.description || '',
      serviceDate: dataSource.serviceDate ? new Date(dataSource.serviceDate) : null,   // not issueDate
      nextServiceDate: dataSource.nextServiceDate ? new Date(dataSource.nextServiceDate) : null, // ✅ not expiryDate
      remindMe: !!dataSource.remindMe,
      currentMileage: dataSource.currentMileage ? Number(dataSource.currentMileage) : null,
      totalCost: dataSource.totalCost ? Number(dataSource.totalCost) : null,
      workshopName: dataSource.workshopName || '',
      imageUrl: dataSource.imageUrl || '',
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };

    await firestore()
      .collection('users')
      .doc(email)
      .collection('vehicles')
      .doc(vehicleId)
      .collection('services')
      .doc(serviceId)
      .update(data);

    return serviceId;
  } catch (error) {
    console.error('Error updating service:', error);
    throw error;
  }
};


// UPDATE VEHICLE
export const updateUserVehicle = async (email, vehicleId, vehicleData) => {
  try {
    if (!vehicleId) {
      throw new Error('vehicleId is missing or empty');
    }

    console.log('Vehicle ID:', vehicleId);
    console.log('Updating Vehicle Data:', vehicleData);

    const data = {
      brand: vehicleData.brand || '',
      model: vehicleData.model || '',
      year: vehicleData.year || '',
      imageUrl: vehicleData.imageUrl || '',
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };

    await firestore()
      .collection('users')
      .doc(email)
      .collection('vehicles')
      .doc(vehicleId)
      .update(data);

    return { success: true, vehicleId };
  } catch (error) {
    console.error('Error updating vehicle:', error);
    throw error;
  }
};

export const deleteUserVehicle = async (email, vehicleId) => {
  try {
    

    await firestore()
      .collection('users')
      .doc(email)
      .collection('vehicles')
      .doc(vehicleId)
      .delete();

    console.log('Vehicle deleted successfully');
    return { success: true };
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    throw error;
  }
};



const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUserInfo: (state, action) => {
      state.name = action.payload.name;
      state.email = action.payload.email;
      state.photo = action.payload.photo;
      state.termCondition=action.payload.termCondition;
    },

    setUserEmail:(state, action)=>{
      state.userEmail = action.payload;
    },
    
    setSelectedCar:(state, action)=>{
        state.selectedCar = action.payload
    },
    setaddVehicalModalRd:(state, action)=>{
        state.VehicalModal = action.payload
    },
    setTrigger:(state,action)=>{
        state.Trigger=action.payload
    },

    clearUser: (state) => {
      state.name = '';
      state.email = '';
      state.photo = '';
      state.termCondition=''
    },
  },
});

export const { setUserInfo, clearUser, setUserEmail, setSelectedCar,setTrigger, setaddVehicalModalRd } = userSlice.actions;
export default userSlice.reducer;