import { StyleSheet, Text, View, KeyboardAvoidingView, Keyboard, TouchableOpacity, TextInput, Image, ScrollView } from 'react-native'
import React, { useEffect } from 'react'
import Modal from 'react-native-modal';
import CloseIcon from '../assets/svg/CloseIcon.jsx';

const FIELD_LABELS = {
  oilType: 'Oil Type',
  oilQuantity: 'Oil Quantity',
  filterBrand: 'Filter Brand',
  tireBrand: 'Tire Brand',
  tireSize: 'Tire Size',
  quantity: 'Quantity',
  padBrand: 'Brake Pad Brand',
  frontOrRear: 'Position',
  servicePackage: 'Service Package',
};

const ViewServiceModal = ({ forView, setForView, serviceData, setServiceData }) => {

  useEffect(() => {
    console.log('Service Data::', serviceData)
  }, [serviceData])

  const formatFirestoreDate = (timestamp) => {
    if (!timestamp || typeof timestamp._seconds !== 'number') {
      return '--';
    }
    return new Date(timestamp._seconds * 1000).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (!serviceData) return null;

  return (
    <View style={styles.container}>
      <Modal
        isVisible={forView}
        statusBarTranslucent
        backdropColor="rgba(4, 25, 51, 0.6)"        
    
        onBackdropPress={() => {
          Keyboard.dismiss();
          setForView(false)
        }}
        style={styles.modal}
        avoidKeyboard
        coverScreen
      >
        <KeyboardAvoidingView
          style={[styles.modalView, { backgroundColor: '#fff' }]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 24, gap: 16 }}
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#041933', fontFamily: 'RobotoCondensed400', fontSize: 18 }}>
                View Service
              </Text>
              <TouchableOpacity onPress={() => setForView(false)}>
                <CloseIcon />
              </TouchableOpacity>
            </View>

            {/* Service Name */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: 'RobotoCondensed400', fontSize: 14 }}>Service Name</Text>
              <TextInput
                style={styles.input}
                value={serviceData?.name || ''}
                editable={false}
              />
            </View>

            {/* Service Date */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: 'RobotoCondensed400', fontSize: 14 }}>Service Date</Text>
              <TextInput
                style={styles.input}
                value={formatFirestoreDate(serviceData?.serviceDate)}
                editable={false}
              />
            </View>

            {/* Next Service Date */}
            {serviceData?.nextServiceDate ? (
              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: 'RobotoCondensed400', fontSize: 14 }}>Next Service Date</Text>
                <TextInput
                  style={styles.input}
                  value={formatFirestoreDate(serviceData?.nextServiceDate)}
                  editable={false}
                />
              </View>
            ) : null}

            {/* Dynamic Extra Fields */}
            {Object.entries(FIELD_LABELS).map(([key, label]) => (
              serviceData?.[key] ? (
                <View key={key} style={{ gap: 8 }}>
                  <Text style={{ fontFamily: 'RobotoCondensed400', fontSize: 14 }}>{label}</Text>
                  <TextInput
                    style={styles.input}
                    value={serviceData[key]?.toString() || ''}
                    editable={false}
                  />
                </View>
              ) : null
            ))}

            {/* Current Mileage & Total Cost Row */}
            {(serviceData?.currentMileage || serviceData?.totalCost) ? (
              <View style={{ flexDirection: 'row', gap: 16 }}>
                {serviceData?.currentMileage ? (
                  <View style={{ gap: 8, flex: 1 }}>
                    <Text style={{ fontFamily: 'RobotoCondensed400', fontSize: 14 }}>Current Mileage</Text>
                    <TextInput
                      style={styles.input}
                      value={serviceData?.currentMileage?.toString() || ''}
                      editable={false}
                    />
                  </View>
                ) : null}

                {serviceData?.totalCost ? (
                  <View style={{ gap: 8, flex: 1 }}>
                    <Text style={{ fontFamily: 'RobotoCondensed400', fontSize: 14 }}>Total Cost</Text>
                    <TextInput
                      style={styles.input}
                      value={serviceData?.totalCost?.toString() || ''}
                      editable={false}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Workshop Name */}
            {serviceData?.workshopName ? (
              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: 'RobotoCondensed400', fontSize: 14 }}>Workshop Name</Text>
                <TextInput
                  style={styles.input}
                  value={serviceData?.workshopName || ''}
                  editable={false}
                />
              </View>
            ) : null}

            {/* Description */}
            {serviceData?.description ? (
              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: 'RobotoCondensed400', fontSize: 14 }}>Description</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  value={serviceData.description}
                  editable={false}
                  multiline
                />
              </View>
            ) : null}

            {/* Service Image */}
            {serviceData?.imageUrl ? (
              <View style={{ gap: 8, marginTop: 8, alignSelf: 'center' }}>
                <Image
                  source={{ uri: serviceData.imageUrl }}
                  style={styles.serviceImage}
                  resizeMode="cover"
                />
              </View>
            ) : null}

          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

export default ViewServiceModal

const styles = StyleSheet.create({
  container: { flex: 1 },
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  modalView: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
  },
  input: {
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEF1F5',
    color: '#041933',
    fontFamily: 'RobotoCondensed400',
    fontSize: 14,
  },
  serviceImage: {
    width: 163,
    height: 100,
    borderRadius: 12,
  }
})