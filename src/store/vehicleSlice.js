import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  vehiclesInformation: []
};

const vehicleSlice = createSlice({
  name: "vehicle",
  initialState,
  reducers: {
    // set full array
    setVehiclesInformation: (state, action) => {
      state.vehiclesInformation = action.payload;
    },

    // add one vehicle
    addVehicle: (state, action) => {
      state.vehiclesInformation.push(action.payload);
    },

    // remove by index (optional)
    removeVehicle: (state, action) => {
      state.vehiclesInformation = state.vehiclesInformation.filter(
        (_, index) => index !== action.payload
      );
    },

    // reset
    resetVehicles: () => initialState
  },
});

export const {
  setVehiclesInformation,
  addVehicle,
  removeVehicle,
  resetVehicles
} = vehicleSlice.actions;

export default vehicleSlice.reducer;