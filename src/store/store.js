import { configureStore } from "@reduxjs/toolkit";
import themeReducer from './themeSlice'
import vehicleReducer from "./vehicleSlice";
import userReducer from './userSlice';
const store =  configureStore({
   reducer:{
    theme:themeReducer,
    vehicle:vehicleReducer,
    user: userReducer,
   }
   
})

export default store