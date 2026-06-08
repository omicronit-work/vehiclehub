import { StyleSheet, Text, View, KeyboardAvoidingView, Keyboard, TouchableOpacity, TextInput, Image, ScrollView } from 'react-native'
import React, { useEffect } from 'react'
import Modal from 'react-native-modal';
import CloseIcon from '../assets/svg/CloseIcon.jsx';

const ViewDocumentModal = ({ forDocumentView, setForDocumentView, documentData, setDocumentData }) => {

  useEffect(() => {
    console.log('Document Data::', documentData)
  }, [documentData])

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

  if (!documentData) return null;

  return (
    <View style={styles.container}>
      <Modal
        isVisible={forDocumentView}
        statusBarTranslucent
        backdropColor="rgba(4, 25, 51, 0.6)"        
        onBackdropPress={() => {
          Keyboard.dismiss();
          setForDocumentView(false)
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: '#041933', fontFamily: 'RobotoCondensed400', fontSize: 18 }}>
                  View Document
                </Text>
                <TouchableOpacity onPress={() => setForDocumentView(false)}>
                  <CloseIcon />
                </TouchableOpacity>
              </View>
            </View>

            {/* Document Name */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: 'RobotoCondensed400', fontSize: 14, color: '#041933' }}>Document Name*</Text>
              <TextInput
                style={styles.input}
                value={documentData?.documentName || ''}
                editable={false}
              />
            </View>

            {/* Dates Layout Row */}
            <View style={{ flexDirection: 'row', gap: 16 }}>
              {/* Issue Date */}
              <View style={{ gap: 8, flex: 1 }}>
                <Text style={{ fontFamily: 'RobotoCondensed400', fontSize: 14, color: '#041933' }}>Issue Date</Text>
                <TextInput
                  style={styles.input}
                  value={formatFirestoreDate(documentData?.issueDate)}
                  editable={false}
                />
              </View>

              {/* Expiry Date */}
              <View style={{ gap: 8, flex: 1 }}>
                <Text style={{ fontFamily: 'RobotoCondensed400', fontSize: 14, color: '#041933' }}>Expiry Date</Text>
                <TextInput
                  style={styles.input}
                  value={formatFirestoreDate(documentData?.expiryDate)}
                  editable={false}
                />
              </View>
            </View>

            {/* Description */}
            {documentData?.description ? (
              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: 'RobotoCondensed400', fontSize: 14, color: '#041933' }}>Description</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  value={documentData.description}
                  editable={false}
                  multiline
                />
              </View>
            ) : null}

            {/* Document Image at Bottom (Renders conditionally if imageUrl exists) */}
            {documentData?.imageUrl ? (
              <View style={{ gap: 8, marginTop: 8, alignSelf: 'center' }}>
                <Image
                  source={{ uri: documentData.imageUrl }}
                  style={styles.documentImage}
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

export default ViewDocumentModal

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
    backgroundColor: '#fff'
  },
  documentImage: {
    width: 163,
    height: 100,
    borderRadius: 12,
  }
})