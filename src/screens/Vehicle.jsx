import React, { useState, useCallback } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Typography } from '../styles/typography.js';
import { GlobalStyles } from '../styles/globalStyles';
import { useDispatch, useSelector } from 'react-redux';
import { fetchVehicleByEmail } from '../store/fetchSlice.js';
import { setaddVehicalModalRd, deleteUserVehicle, setTrigger } from '../store/userSlice.js';
import { useFocusEffect } from '@react-navigation/native';

// Components & Assets
import VehicleCard from '../components/VehicleCard.jsx';
import Car from '../assets/svg/Car.jsx';
import AddIcon from '../assets/svg/AddIcon.jsx';
import SkeletonVehicleCard from '../skeleton/SkeletonVehicleCard.jsx';
import VehicalUpdate from '../modals/VehicleUpdate.jsx';
import VehicleInformations from '../components/VehicleInformations.jsx';
import VehicleInfo from '../assets/svg/VehicleInfo.jsx'

const Vehicle = () => {
  const { userEmail, Trigger } = useSelector(state => state.user);
  const [vehicle, setVehicle] = useState([]);
  const [swipedItemId, setSwipedItemId] = useState(null);
  const [VehicleUpdateModal, setVehicalUpdate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [EditValue, setEditValue] = useState([]);
  const [ImageUrl, setImageUrl] = useState(null);
  const [vehicleinformation, setvehicleInformation] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);
  const dispatch = useDispatch();

  const loadVehicle = async () => {
    setLoading(true);
    setSwipedItemId(null);
    setVehicalUpdate(false);
    setEditValue([]);
    setImageUrl(null);
    setvehicleInformation(false);
    setSelectedCar(null);
    
    try {
      const vehicleData = await fetchVehicleByEmail(userEmail);
      setVehicle(vehicleData);
    } catch (error) {
      console.log('Error fetching vehicle:', error);
    } finally {
      setLoading(false);
      dispatch(setTrigger(false));
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!userEmail) return;
      loadVehicle();
    }, [userEmail, Trigger])
  );

  const handleRefresh = () => {
    dispatch(setTrigger(!Trigger));
  };

  const handleEdit = (item) => {
    setEditValue(item);
    setVehicalUpdate(true);
    setImageUrl(item.imageUrl);
  };

  const handleDelete = async (item) => {
    try {
      await deleteUserVehicle(userEmail, item.id);
      loadVehicle();
      setSwipedItemId(null);
    } catch (error) {
      console.log(error);
    }
  };

  const handleCardPress = (item) => {
    console.log('Selected Car::', item)
    setSelectedCar(item);
    setvehicleInformation(true);
  };

  if (loading) {
    return (
      <View style={GlobalStyles.screen}>
        <View style={GlobalStyles.BodyContainer}>
          <View style={styles.headerRow}>
            <Car color={'#041933'} />
            <Text style={styles.title}>My Vehicle</Text>
          </View>
          {[1, 2, 3, 4].map((key) => (
            <SkeletonVehicleCard key={key} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={GlobalStyles.screen}>
      <View style={GlobalStyles.BodyContainer}>
        {vehicleinformation ? (
          <View style={{   }}>
            {/* FIXED: Removed extra flexDirection: 'row' wrapper */}
            <View style={styles.headerRow}>
              <Car color={'#041933'} />
              <Text style={styles.title}>{selectedCar?.brand || 'Vehicle'}</Text>
            </View>
            <View style={{minHeight:'100%',   }}>
              <VehicleInformations selectedCar={selectedCar} />
            </View>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', justifyContent:'space-between'  }}>
              <View style={styles.headerRow}>
                <Car color={'#041933'} />
                <Text style={styles.title}>My Vehicle</Text>
              </View>
              <View style={{  top:5   }}>
                <TouchableOpacity onPress={() => dispatch(setaddVehicalModalRd(true))}>
                  <AddIcon color={'#004EAB'} />
                </TouchableOpacity>
              </View>
            </View>
            <FlatList
              data={vehicle}
              renderItem={({ item }) => (
                <VehicleCard
                  item={item}
                  swipedItemId={swipedItemId}
                  setSwipedItemId={setSwipedItemId}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  setImageUrl={setImageUrl}
                  onCardPress={handleCardPress}
                />
              )}
              keyExtractor={(item, index) => item.id?.toString() || index.toString()}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <VehicleInfo color={'#004EAB'}/>
                  <View style={{
                    alignItems:'center',
                    gap:8,
                    marginTop:15
                  }}>
                  <Text style={styles.emptyText}>No Vehicles Found</Text>
                  <Text style={{
                    fontFamily:'RobotoCondensed300',
                    color:'rgba(0, 78, 171, 0.5)'
                  }}>Add your vehicle to start tracking services.</Text>
                  </View>
                </View>
              }
            />
          </>
        )}

        <VehicalUpdate
          VehicleUpdateModal={VehicleUpdateModal}
          setVehicalUpdate={setVehicalUpdate}
          EditValue={EditValue}
          ImageUrl={ImageUrl}
          onVehicleUpdated={loadVehicle}
          setImageUrl={setImageUrl}
        />
      </View>
    </View>
  );
};

export default Vehicle;

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    marginLeft: 10,
    fontSize: 18,
    fontFamily: Typography.font.regular,
    color: '#000',
  },
  listContent: {
    paddingBottom: 20,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: Typography.font.regular,
    color: 'rgba(0, 78, 171, 0.5)',
  },
  refreshBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
  },
});