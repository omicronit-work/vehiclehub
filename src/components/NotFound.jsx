// NotFound.js

import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import Text from './ui/AppText';
import { t as tr } from '../i18n';
 

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
            ? tr('Documents List is Empty')
            : tr('No Service Record Found')}
        </Text>

        <Text style={styles.descriptionText}>
          {isDocuments
            ? tr('Upload your documents to keep your vehicle paperwork organised.')
            : tr('Add a record to keep your maintenance history up to date.')}
        </Text>
      </View>

      <TouchableOpacity
        onPress={onPress}
        style={styles.button}
      >
        {/* <AddIcon color="#fff" /> */}

        <Text style={styles.buttonText}>
          {tr('Add Service Record')}
        </Text>
      </TouchableOpacity>
    </>
  );
};

export default NotFound;