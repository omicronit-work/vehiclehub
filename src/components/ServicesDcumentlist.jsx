import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';

import NotFound from '../assets/svg/NotFound.jsx';
import AddIcon from '../assets/svg/AddIcon.jsx';
import EditIcon from '../assets/svg/EditIcon.jsx';
import AddDocument from '../modals/AddDocument.jsx';
import DocumentUpdate from '../modals/DocumentUpdate.jsx';
import ServiceUpdate from '../modals/ServiceUpdate.jsx';
import SelectedEditIcon from '../assets/svg/SelectedEditIcon.jsx';
import { useSelector } from 'react-redux';
import { fetchDocumentssByid, fetchServicesByid } from '../store/fetchSlice.js';

const SERVICE_NAME = [
  { id: 1, name: 'Engine Oil Refill', icon: require('../assets/icons/oil.png') },
  { id: 2, name: 'Oil Filter', icon: require('../assets/icons/filter.png') },
  { id: 3, name: 'Tires Change', icon: require('../assets/icons/tyre.png') },
  { id: 4, name: 'Gear Oil', icon: require('../assets/icons/oil.png') },
  { id: 5, name: 'Brake Pads', icon: require('../assets/icons/break.png') },
  { id: 6, name: 'Full Body Servicing', icon: require('../assets/icons/service.png') },
];

const ServicesDcumentlist = ({ category, setAddServiceModal, refreshTrigger}) => {
  const { userEmail, selectedCar } = useSelector((state) => state.user);
  const vehicles = useSelector((state) => state.vehicle.vehiclesInformation);
  
  const [services, setServices] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [updateData, setUpdateData] = useState(null);
  const [forView, setForView] = useState(false);

  const [AddDocumentModal, setAddDocumentModal] = useState(false);
  const [DocumentUpdateModal, setDocumentUpdateModal] = useState(false);
  const [ServiceUpdateModal, setServiceUpdateModal] = useState(false);
  const [refreshTriggerdoc, setRefreshTriggerdoc] = useState(0);

  const isServiceCategory =
    category?.toLowerCase?.() === 'service' ||
    category?.toLowerCase?.() === 'services';

  const listData = isServiceCategory ? services : documents;

 

  useEffect(() => {
    setServices([]);
    setLoading(true);

    let isCancelled = false;

    const fetchData = async () => {
      try {
        const res = await fetchServicesByid(userEmail , selectedCar);
        const documentData = await fetchDocumentssByid(userEmail, selectedCar);


    
     
        if (!isCancelled) {
          setServices(res || []);
          setDocuments(documentData || []);
        }
        console.log('SSSSS::', services)
      } catch (error) {
        if (!isCancelled) {
          console.error('Error fetching services:', error);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    if (userEmail && selectedCar) {
      fetchData();
    } else {
      setLoading(false);
    }

    return () => {
      isCancelled = true;
    };
  }, [selectedCar, userEmail, category, refreshTrigger, refreshTriggerdoc]);

  const getServiceIcon = useCallback((name) => {
    const match = SERVICE_NAME.find((item) => item.name === name);
    return match ? match.icon : null;
  }, []);

  const formatDate = useCallback((dateValue) => {
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
      if (category === 'documents') {
        setUpdateData(documents[index]);
        setDocumentUpdateModal(true);
      } else {
        console.log('Item::', vehicles);
        setUpdateData(services[index]);
        setServiceUpdateModal(true);
      }
    },
    [category, documents, services, vehicles]
  );

  const handleCardPress = useCallback((id) => {
    setSelectedId(id);
  }, []);

  const handleAddPress = useCallback(() => {
    if (isServiceCategory) {
      setAddServiceModal(true);
    } else {
      setAddDocumentModal(true);
    }
  }, [isServiceCategory, setAddServiceModal]);

  const renderItem = (item, index) => {
    const isService = isServiceCategory;
    const iconSource = isService
      ? getServiceIcon(item.name)
      : require('../assets/icons/document.png');
    const title = isService ? item.name : item.documentName;
    const date = isService
      ? item.serviceDate
      : item.expiryDate || item.issueDate;
    const itemId = item.id || index;
    const isSelected = selectedId === itemId;

    return (
      <TouchableOpacity
        key={item.id?.toString?.() || index.toString()}
        onPress={() => {
          handleCardPress(itemId);
          setForView(true);
          handleEditPress(item, index);
        }}
        style={[
          styles.card,
          {
            borderWidth: isSelected ? 1 : 0,
            borderColor: isSelected ? 'rgba(0, 78, 171, 1)' : 'transparent',
          },
        ]}
      >
        <View style={{ flexDirection: 'row', gap: 10, flex: 1 }}>
          {iconSource ? (
            <View style={{ paddingTop: 2 }}>
              <Image source={iconSource} style={styles.icon} />
            </View>
          ) : (
            <View style={styles.fallbackIcon} />
          )}

          <View style={{ gap: 8 }}>
            <Text style={styles.title}>{title || 'Unnamed'}</Text>
            <Text style={styles.date}>{formatDate(date)}</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => handleEditPress(item, index)}
          style={{ alignItems: 'flex-end', width: 50 }}
        >
          {isSelected ? <SelectedEditIcon /> : <EditIcon />}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const SkeletonList = () => {
    return (
      <View style={{ marginTop: 16 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((_, i) => (
          <View key={i} style={{ marginTop: i === 0 ? 0 : 12 }}>
            <SkeletonRow />
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.listContainer}>
        <SkeletonList />
      </View>
    );
  }

  return (
    <View style={styles.listContainer}>
      {/* Empty State */}
      {listData.length === 0 && (
        <View style={styles.emptyContentContainer}>
          <NotFound />
          <View style={{ gap: 8 }}>
            <Text style={styles.titleText}>
              {isServiceCategory
                ? 'No Service Record Found'
                : 'Documents List is Empty'}
            </Text>
            <Text style={styles.descriptionText}>
              {isServiceCategory
                ? 'Add a record to keep your maintenance history up to date.'
                : 'Upload your documents to keep your vehicle organised.'}
            </Text>
          </View>
          <TouchableOpacity onPress={handleAddPress} style={styles.button}>
            <AddIcon color="#fff" />
            <Text style={styles.buttonText}>
              {isServiceCategory ? 'Add Service Record' : 'Add New Document'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List Items Map */}
      {listData.length > 0 && (
        <View>
          {listData.map((item, index) => renderItem(item, index))}
          
          {/* Footer Add Button */}
          <View style={styles.listButtonWrapper}>
            <TouchableOpacity onPress={handleAddPress} style={styles.button}>
              <AddIcon color="#fff" />
              <Text style={styles.buttonText}>
                {isServiceCategory ? 'Add Service Record' : 'Add New Document'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modals */}
      <DocumentUpdate
        forView={forView}
        setForView={setForView}
        updateData={updateData}
        DocumentUpdateModal={DocumentUpdateModal}
        setDocumentUpdateModal={setDocumentUpdateModal}
        onDocumentUpdated={() => setRefreshTriggerdoc((prev) => prev + 1)}
      />

      <ServiceUpdate
        forView={forView}
        setForView={setForView}
        updateData={updateData}
        ServiceUpdateModal={ServiceUpdateModal}
        setServiceUpdateModal={setServiceUpdateModal}
        onServiceUpdated={() => setRefreshTriggerdoc((prev) => prev + 1)}
      />

      <AddDocument
        AddDocumentModal={AddDocumentModal}
        setAddDocumentModal={setAddDocumentModal}
        onDocumentAdded={() => setRefreshTriggerdoc((prev) => prev + 1)}
      />
    </View>
  );
};

const SkeletonRow = () => (
  <View style={styles.skeletonCard}>
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={styles.skeletonIcon} />
      <View style={{ gap: 6 }}>
        <View style={styles.skeletonLineLong} />
        <View style={styles.skeletonLineShort} />
      </View>
    </View>
    <View style={styles.skeletonEditIcon} />
  </View>
);

export default ServicesDcumentlist;

const styles = StyleSheet.create({
  listContainer: {
    width: '100%',
  },
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
  },
  icon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  fallbackIcon: {
    width: 18,
    height: 18,
    marginTop: 2,
    backgroundColor: '#ccc',
    borderRadius: 4,
  },
  title: {
    fontSize: 14,
    color: 'rgba(4, 25, 51, 1)',
    fontFamily: 'RobotoCondensed500',
  },
  date: {
    fontSize: 12,
    color: 'rgba(4, 25, 51, 0.68)',
    fontFamily: 'RobotoCondensed400',
  },
  button: {
    marginTop: 20,
    height: 38,
    minWidth: 164,
    maxWidth: 200,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 78, 171, 1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
  },
  titleText: {
    fontSize: 16,
    textAlign: 'center',
    color: 'rgba(0, 78, 171, 0.5)',
  },
  descriptionText: {
    fontSize: 14,
    textAlign: 'center',
    color: 'rgba(0, 78, 171, 0.5)',
  },
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
    width: 18,
    height: 18,
    backgroundColor: '#E3E3E3',
  },
  skeletonLineLong: {
    width: 120,
    height: 10,
    backgroundColor: '#E3E3E3',
    borderRadius: 10,
  },
  skeletonLineShort: {
    width: 80,
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