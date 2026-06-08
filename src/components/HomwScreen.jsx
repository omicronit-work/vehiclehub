import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
 

const HomeScreen = () => {
  const [selectedVehicle, setSelectedVehicle] = useState(1);

  const vehicles = [
    { id: 1, name: 'Toyota X', icon: null },
    { id: 2, name: 'Nissan X', icon: null },
    { id: 3, name: 'Toyota Voxy', icon: null },
  ];

  const services = [
    { id: 1, title: 'Engine oil refill', date: '20 Jan 2026', icon: null, active: true },
    { id: 2, title: 'Oil Filter', date: '16 Jan 2026', icon: null },
    { id: 3, title: 'Gear Oil', date: '14 Jan 2026', icon: null  },
    { id: 4, title: 'Tires Change', date: '20 Dec 2025', icon: null },
    { id: 5, title: 'Brake Pads', date: '12 Dec 2025', icon: null },
    { id: 6, title: 'Full Body Servicing', date: '25 Nov 2025', icon: null },
  ];

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" />
      
      {/* Blue Curved Header */}
      <View style={styles.headerContainer}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <View style={styles.logoCircle}>
                 
            </View>
            <View style={styles.profileBadge}>
              <Text style={styles.profileText}>JR</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
        {/* Title Section */}
        <View style={styles.sectionHeader}>
          <View style={styles.titleRow}>
            {/* <CarIcon size={24} color="#000" style={{marginRight: 8}} /> */}
            <Text style={styles.sectionTitle}>All Vehicles</Text>
          </View>
          <TouchableOpacity>
           
          </TouchableOpacity>
        </View>

        {/* Vehicle Selection Cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vehicleList}>
          {vehicles.map((v) => (
            <TouchableOpacity 
              key={v.id} 
              onPress={() => setSelectedVehicle(v.id)}
              style={[styles.vehicleCard, selectedVehicle === v.id && styles.activeVehicleCard]}
            >
              {v.icon}
              <Text style={[styles.vehicleName, selectedVehicle === v.id && styles.activeVehicleText]}>
                {v.name}
              </Text>
              {selectedVehicle === v.id && <View style={styles.activePointer} />}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <Text style={[styles.tabItem, styles.activeTab]}>Services</Text>
          <Text style={styles.tabItem}>Documents</Text>
        </View>

        {/* Service List */}
        <View style={styles.serviceListContainer}>
          {services.map((s) => (
            <View key={s.id} style={[styles.serviceCard, s.active && styles.activeServiceBorder]}>
              <View style={styles.serviceIconContainer}>
                {s.icon}
              </View>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceTitleText}>{s.title}</Text>
                <Text style={styles.serviceDateText}>{s.date}</Text>
              </View>
              <TouchableOpacity>
                {/* <Edit3 size={18} color="#0056b3" /> */}
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity style={styles.fab}>
 
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#fff' },
  headerContainer: {
    backgroundColor: '#0056b3',
    height: 140,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  logoCircle: {
    width: 35, height: 35, borderRadius: 10,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center'
  },
  profileBadge: {
    width: 35, height: 35, borderRadius: 17.5,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center'
  },
  profileText: { color: '#0056b3', fontWeight: 'bold', fontSize: 12 },
  contentScroll: { flex: 1, marginTop: -30, paddingHorizontal: 20 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20
  },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a' },
  plusIconBorder: { borderWidth: 1, borderColor: '#0056b3', borderRadius: 12, padding: 2 },
  vehicleList: { marginBottom: 25 },
  vehicleCard: {
    width: 120, height: 110, backgroundColor: '#fff', borderRadius: 15,
    marginRight: 15, alignItems: 'center', justifyContent: 'center',
    elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8,
  },
  activeVehicleCard: { backgroundColor: '#0056b3' },
  vehicleName: { marginTop: 10, fontSize: 14, fontWeight: '600', color: '#0056b3' },
  activeVehicleText: { color: '#fff' },
  activePointer: {
    position: 'absolute', bottom: -8, width: 16, height: 16,
    backgroundColor: '#0056b3', transform: [{ rotate: '45deg' }]
  },
  tabContainer: { flexDirection: 'row', marginBottom: 20 },
  tabItem: { fontSize: 18, marginRight: 25, color: '#8e8e93' },
  activeTab: { color: '#0056b3', fontWeight: 'bold', borderBottomWidth: 2, borderBottomColor: '#0056b3' },
  serviceListContainer: { paddingBottom: 100 },
  serviceCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    padding: 16, borderRadius: 16, marginBottom: 15,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5,
    borderWidth: 1, borderColor: '#f2f2f2'
  },
  activeServiceBorder: { borderColor: '#0056b3' },
  serviceIconContainer: { marginRight: 15 },
  serviceInfo: { flex: 1 },
  serviceTitleText: { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a' },
  serviceDateText: { fontSize: 13, color: '#8e8e93', marginTop: 4 },
  fab: {
    position: 'absolute', right: 20, bottom: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#0056b3', alignItems: 'center', justifyContent: 'center',
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10
  }
});

export default HomeScreen;