import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { useSelector } from 'react-redux';
import { fetchDocumentssByid, fetchServicesByid } from '../store/fetchSlice';

// SVG Icons
import NotFound from '../assets/svg/NotFound.jsx';
import Vehicle from '../assets/svg/Vehicle.jsx'
import AddIcon from '../assets/svg/AddIcon.jsx';
import EditIcon from '../assets/svg/EditIcon.jsx';
import SelectedEditIcon from '../assets/svg/SelectedEditIcon.jsx';
import ViewServiceModal from '../modals/ViewServiceModal.jsx';
import ViewDocumentModal from '../modals/ViewDocumentModal.jsx';

const SERVICE_NAME = [
  {
    id: 1,
    name: 'Engine Oil Refill',
    icon: require('../assets/icons/oil.png'),
  },
  { id: 2, name: 'Oil Filter', icon: require('../assets/icons/filter.png') },
  { id: 3, name: 'Tires Change', icon: require('../assets/icons/tyre.png') },
  { id: 4, name: 'Gear Oil', icon: require('../assets/icons/oil.png') },
  { id: 5, name: 'Brake Pads', icon: require('../assets/icons/break.png') },
  {
    id: 6,
    name: 'Full Body Servicing',
    icon: require('../assets/icons/service.png'),
  },
];

const TABS = ['Services', 'Documents'];

const VehicleInformations = ({ selectedCar }) => {
  const { userEmail } = useSelector(state => state.user);

  const [tab, setTab] = useState('Services');
  const [services, setServices] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState(null);
  const [updateData, setUpdateData] = useState(null);

  const [forView, setForView] = useState(false);
  const [forDocumentView, setForDocumentView] = useState(false);

  const [serviceData, setServiceData] = useState(null);
  const [documentData, setDocumentData] = useState(null);

  const [addServiceModal, setAddServiceModal] = useState(false);
  const [addDocumentModal, setAddDocumentModal] = useState(false);
  const [documentUpdateModal, setDocumentUpdateModal] = useState(false);
  const [serviceUpdateModal, setServiceUpdateModal] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const isServiceTab = tab === 'Services';

  const listData = useMemo(() => {
    return isServiceTab ? services : documents;
  }, [isServiceTab, services, documents]);

  const handleTabChange = useCallback(
    selectedTab => {
      if (tab !== selectedTab) {
        setLoading(true);
        setSelectedId(null);
        setTab(selectedTab);
      }
    },
    [tab],
  );

  useEffect(() => {
    setLoading(true);
    let isCancelled = false;

    const fetchData = async () => {
      try {
        const carId =
          typeof selectedCar === 'object' ? selectedCar?.id : selectedCar;
        if (!userEmail || !carId) {
          setLoading(false);
          return;
        }

        const [serviceRes, docRes] = await Promise.all([
          fetchServicesByid(userEmail, carId),
          fetchDocumentssByid(userEmail, carId),
        ]);

        if (!isCancelled) {
          setServices(serviceRes || []);
          setDocuments(docRes || []);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Error handling sync:', error);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [selectedCar, userEmail, refreshTrigger, tab]);

  const getServiceIcon = useCallback(name => {
    const match = SERVICE_NAME.find(
      item => item.name?.toLowerCase() === name?.toLowerCase(),
    );
    return match ? match.icon : require('../assets/icons/service.png');
  }, []);

  const formatDate = useCallback(dateValue => {
    if (!dateValue) return 'No date';
    let date;
    if (dateValue._seconds) {
      date = new Date(dateValue._seconds * 1000);
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      date = new Date(dateValue);
    }
    if (isNaN(date.getTime())) return 'No date';

    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  const handleEditPress = useCallback(
    (item, index) => {
      setSelectedId(item.id || index);

      if (!isServiceTab) {
        setDocumentData(item);
        setUpdateData(documents[index]);
        setDocumentUpdateModal(true);
      } else {
        setServiceData(item);
        setUpdateData(services[index]);
        setServiceUpdateModal(true);
      }
    },
    [isServiceTab, documents, services],
  );

  const handleAddPress = useCallback(() => {
    if (isServiceTab) {
      setAddServiceModal(true);
    } else {
      setAddDocumentModal(true);
    }
  }, [isServiceTab]);

  const renderItem = (item, index) => {
    const iconSource = isServiceTab
      ? getServiceIcon(item.name)
      : require('../assets/icons/document.png');

    const title = isServiceTab ? item.name : item.documentName;
    const date = isServiceTab
      ? item.serviceDate
      : item.expiryDate || item.issueDate;
    const itemId = item.id || index;
    const isSelected = selectedId === itemId;

    return (
      <TouchableOpacity
        key={item.id?.toString?.() || index.toString()}
        onPress={() => {
          setSelectedId(itemId);
          if (!isServiceTab) {
            setDocumentData(item);
            setForDocumentView(true);
          } else {
            setServiceData(item);
            setForView(true);
          }
        }}
        style={[styles.card, isSelected && styles.selectedCard]}
      >
        <View style={styles.cardContent}>
          <View style={styles.iconContainer}>
            <Image source={iconSource} style={styles.icon} />
          </View>
          <View style={styles.textGroup}>
            <Text style={styles.title}>{title || 'Unnamed'}</Text>
            <Text style={styles.date}>{formatDate(date)}</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => handleEditPress(item, index)}
          style={styles.editIconWrapper}
        >
          {isSelected ? <SelectedEditIcon /> : <EditIcon />}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const SkeletonList = () => (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3].map((_, i) => (
        <View key={i} style={[styles.skeletonCard, i > 0 && { marginTop: 12 }]}>
          <View style={styles.cardContent}>
            <View style={styles.skeletonIcon} />
            <View style={styles.textGroup}>
              <View style={styles.skeletonLineLong} />
              <View style={styles.skeletonLineShort} />
            </View>
          </View>
          <View style={styles.skeletonEditIcon} />
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {selectedCar?.imageUrl ? (
        <Image
          style={styles.image}
          source={{ uri: selectedCar.imageUrl }}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.image, styles.fallbackImageContainer]}>
          <Vehicle color={'#004EAB'} />
        </View>
      )}

      <View style={styles.tabContainer}>
        {TABS.map(tabName => {
          const isActive = tab === tabName;
          return (
            <TouchableOpacity
              key={tabName}
              onPress={() => handleTabChange(tabName)}
            >
              <Text style={[styles.tabText, !isActive && styles.inactiveTab]}>
                {tabName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.listWrapper}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <SkeletonList />
        ) : (
          <View>
            {listData.length === 0 && (
              <View style={styles.emptyContentContainer}>
                <NotFound />
                <View style={styles.textGroupCenter}>
                  <Text style={styles.titleText}>
                    {isServiceTab
                      ? 'No Service Record Found'
                      : 'Documents List is Empty'}
                  </Text>
                  <Text style={styles.descriptionText}>
                    {isServiceTab
                      ? 'Add a record to keep your maintenance history up to date.'
                      : 'Upload your documents to keep your vehicle organised.'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleAddPress}
                  style={styles.button}
                >
                  <AddIcon color="#fff" />
                  <Text style={styles.buttonText}>
                    {isServiceTab ? 'Add Service Record' : 'Add New Document'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {listData.length > 0 && (
              <View>
                {listData.map((item, index) => renderItem(item, index))}

                <View style={styles.listButtonWrapper}>
                  <TouchableOpacity
                    onPress={handleAddPress}
                    style={styles.button}
                  >
                    <AddIcon color="#fff" />
                    <Text style={styles.buttonText}>
                      {isServiceTab ? 'Add Service Record' : 'Add New Document'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <ViewServiceModal
        serviceData={serviceData}
        setServiceData={setServiceData}
        forView={forView}
        setForView={setForView}
      />

      <ViewDocumentModal
        documentData={documentData}
        setDocumentData={setDocumentData}
        forDocumentView={forDocumentView}
        setForDocumentView={setForDocumentView}
      />
    </View>
  );
};

export default VehicleInformations;

const styles = StyleSheet.create({
  container: { flex: 1 },
  image: { width: '100%', height: 160, borderRadius: 20 },
  fallbackImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackImageText: {
    color: 'rgba(4, 25, 51, 0.5)',
    fontFamily: 'RobotoCondensed400',
  },
  tabContainer: { flexDirection: 'row', marginTop: 22, gap: 24 },
  tabText: { fontFamily: 'RobotoCondensed400', fontSize: 16, color: '#004EAB' },
  inactiveTab: { opacity: 0.5, fontFamily: 'RobotoCondensed400' },
  listWrapper: { flex: 1 }, // ← FIXED: removed minHeight: 500
  scrollContent: { paddingBottom: 32 },
  emptyContentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    width: '100%',
    paddingVertical: 40,
  },
  listButtonWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  card: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    elevation: 3,
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedCard: { borderColor: 'rgba(0, 78, 171, 1)' },
  cardContent: { flexDirection: 'row', gap: 10, flex: 1 },
  iconContainer: { paddingTop: 2 },
  textGroup: { gap: 8 },
  textGroupCenter: { gap: 8 },
  editIconWrapper: { alignItems: 'flex-end', width: 50 },
  icon: { width: 18, height: 18, resizeMode: 'contain' },
  title: {
    fontSize: 14,
    color: 'rgba(4, 25, 51, 1)',
    fontFamily: 'RobotoCondensed400',
  },
  date: {
    fontSize: 12,
    color: 'rgba(4, 25, 51, 0.68)',
    fontFamily: 'RobotoCondensed400',
  },
  button: {
    marginTop: 20,
    marginBottom:50,
    height: 38,
    minWidth: 180,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 78, 171, 1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontFamily: 'RobotoCondensed500' },
  titleText: {
    fontSize: 16,
    textAlign: 'center',
    color: 'rgba(0, 78, 171, 0.8)',
  },
  descriptionText: {
    fontSize: 14,
    textAlign: 'center',
    color: 'rgba(4, 25, 51, 0.5)',
  },
  skeletonContainer: { marginTop: 16 },
  skeletonCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    elevation: 3,
    marginHorizontal: 2,
  },
  skeletonIcon: {
    width: 22,
    height: 22,
    backgroundColor: '#E3E3E3',
    borderRadius: 4,
  },
  skeletonLineLong: {
    width: 140,
    height: 12,
    backgroundColor: '#E3E3E3',
    borderRadius: 10,
  },
  skeletonLineShort: {
    width: 90,
    height: 10,
    backgroundColor: '#E3E3E3',
    borderRadius: 10,
  },
  skeletonEditIcon: {
    width: 20,
    height: 20,
    backgroundColor: '#E3E3E3',
    borderRadius: 6,
  },
});