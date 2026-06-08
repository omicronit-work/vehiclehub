// NotFound.js

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
 

const NotFound = ({
  category,
  styles,
  onPress,
}) => {
  const isDocuments = category === 'documents';

  return (
    <>
      {/* your image / svg / illustration here */}

      <View style={styles.textContainer}>
        <Text style={styles.titleText}>
          {isDocuments
            ? 'Documents List is Empty'
            : 'No Service Record Found'}
        </Text>

        <Text style={styles.descriptionText}>
          {isDocuments
            ? 'Upload your documents to keep your vehicle paperwork organised.'
            : 'Add a record to keep your maintenance history up to date.'}
        </Text>
      </View>

      <TouchableOpacity
        onPress={onPress}
        style={styles.button}
      >
        {/* <AddIcon color="#fff" /> */}

        <Text style={styles.buttonText}>
          Add Service Record
        </Text>
      </TouchableOpacity>
    </>
  );
};

export default NotFound;