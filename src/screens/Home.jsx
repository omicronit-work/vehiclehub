// Importing required components from React Native
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import React from 'react';

// Custom Components
import Header from '../components/Header';

// Gesture handler text (better scrolling performance)
import { Text } from 'react-native-gesture-handler';

// SVG Icons
import Car from '../assets/svg/Car.jsx';
import Vehicle from '../assets/svg/Vehicle.jsx';
import AddIcon from '../assets/svg/AddIcon.jsx';

// Style constants
import { Typography } from '../styles/typography.js';
import { Colors } from '../styles/colors.js';

const Home = () => {
  return (
    // Main screen wrapper
    <View style={styles.screen}>
      {/* Header Component */}
      <Header />

      {/* White container that overlaps the blue header background */}
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {/* Section Title */}
          <View style={styles.titleRow}>
            <Car />
            <Text style={styles.titleText}>All Vehicles</Text>
          </View>

          {/* Empty State Section (shown when no vehicles exist) */}
          <View style={styles.centeredContent}>
            <View style={styles.emptyStateContainer}>
              {/* Vehicle Illustration */}
              <Vehicle />

              {/* Empty State Text */}
              <View style={styles.emptyTextContainer}>
                <Text style={styles.emptyTitle}>No Vehicles Found</Text>

                <Text style={styles.emptySubtitle}>
                  Add your vehicle to start tracking services.
                </Text>
              </View>

              {/* Add Vehicle Button */}
              <TouchableOpacity style={styles.addButton}>
                <AddIcon />

                <Text style={styles.addButtonText}>Add Vehicle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

export default Home;

const styles = StyleSheet.create({
  // Main screen background (blue like header)
  screen: {
    flex: 1,
    backgroundColor: Colors.primary,
  },

  // White container that sits below the header
  container: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: 5, // creates a slight overlap effect with header
    padding: 24,
  },

  // Row containing car icon + "All Vehicles"
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Title text styling
  titleText: {
    fontSize: 18,
    fontFamily: Typography.font.regular,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center', // Centers vertically
    minHeight: '100%', // Ensures it takes at least full height
  },

  // Empty state container (centered)
  emptyStateContainer: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },

  // Container for empty state texts
  emptyTextContainer: {
    marginTop: 20,
    gap: 8,
    alignItems: 'center',
  },

  // "No Vehicles Found"
  emptyTitle: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.medium,
    color: '#004EAB80',
  },

  // Subtitle text
  emptySubtitle: {
    fontFamily: Typography.font.light,
    fontSize: Typography.textsize.small,
    color: '#004EAB80',
  },

  // Add Vehicle button
  addButton: {
    width: 120,
    height: 40,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginTop: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Button text
  addButtonText: {
    color: '#fff',
    textAlign:'center',
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
  },
});
