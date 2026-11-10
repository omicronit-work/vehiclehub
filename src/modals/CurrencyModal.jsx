import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import React, { useState } from 'react';
import { useSelector } from 'react-redux';

import { Typography } from '../styles/typography.js';
import { Colors } from '../styles/colors.js';
import { themecolors } from '../styles/themecolors.js';
import { currencies } from '../util/currencies.js';
import CloseX from '../assets/svg/CloseX.jsx'
import { accent } from '../theme/accent';
import { useHideAdsWhile } from '../util/ads';
const CurrencyModal = ({ visible, onClose, selected, onSelect, auto, onSelectAuto }) => {
  useHideAdsWhile(visible);
  const { theme } = useSelector((store) => store.theme);
  const [search, setSearch] = useState('');

  const currentBg = theme === 'dark' ? themecolors.darkBlue : themecolors.white;
  const currentText = theme === 'dark' ? themecolors.white : Colors.darkBlue;
  const subText = theme === 'dark' ? themecolors.white : themecolors.deepBlue;

  const filtered = currencies.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q)
    );
  });

  // The parent confirms the switch (and saves it), so nothing is stored here.
  const handleSelect = (item) => {
    onSelect(item);
    setSearch('');
    onClose();
  };

  // "Automatic" follows the user's location; a picked currency is manual.
  const autoRow = onSelectAuto && !search ? (
    <TouchableOpacity
      style={styles.item}
      onPress={() => { onSelectAuto(); setSearch(''); onClose(); }}
      accessibilityRole="button"
      accessibilityLabel="Automatic, based on your location"
      accessibilityState={{ selected: !!auto }}
    >
      <View style={styles.itemLeft}>
        <Text style={[styles.symbol, { color: currentText }]}>⌖</Text>
        <View>
          <Text style={[styles.name, { color: currentText }]}>Automatic</Text>
          <Text style={[styles.code, { color: subText }]}>
            Based on your location · US Dollar if unknown
          </Text>
        </View>
      </View>
      {auto && <Text style={styles.check}>✓</Text>}
    </TouchableOpacity>
  ) : null;

  const renderItem = ({ item }) => {
    const isSelected = !auto && selected?.code === item.code;
    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => handleSelect(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.code}`}
        accessibilityState={{ selected: isSelected }}
      >
        <View style={styles.itemLeft}>
          <Text style={[styles.symbol, { color: currentText }]}>
            {item.symbol}
          </Text>
          <View>
            <Text style={[styles.name, { color: currentText }]}>
              {item.name}
            </Text>
            <Text style={[styles.code, { color: subText }]}>{item.code}</Text>
          </View>
        </View>
        {isSelected && <Text style={styles.check}>✓</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      backdropOpacity={0.55}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Tap outside to close */}
      <TouchableWithoutFeedback onPress={onClose} accessible={false}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={[styles.sheet, { backgroundColor: currentBg }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: currentText }]}>
            Select Currency
          </Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close"
            onPress={onClose}
            style={[
              styles.closeButton,
              { backgroundColor: theme === 'dark' ? accent.lightAlpha(0.14) : accent.alpha(0.08) },
            ]}
          >
            <CloseX size={12} color={theme === 'dark' ? accent.light : accent.primary} />
          </TouchableOpacity>
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search currency..."
          accessibilityLabel="Search currency"
          placeholderTextColor={subText}
          style={[styles.search, { color: currentText, borderColor: search ? (theme === 'dark' ? accent.light : accent.primary) : '#EEF1F5' }]}
        />

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.code}
          renderItem={renderItem}
          ListHeaderComponent={autoRow}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </View>
    </Modal>
  );
};

export default CurrencyModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C4C4C4',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontFamily: Typography.font.regular, fontSize: 18 },
  closeText: { fontSize: 18 },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    height: 42,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginTop: 16,
    marginBottom: 8,
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
  },
  item: {
    minHeight: 56,
    borderBottomWidth: 0.9,
    borderColor: '#EEF1F5',
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemLeft: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  symbol: {
    width: 32,
    textAlign: 'center',
    fontSize: 18,
    fontFamily: Typography.font.regular,
  },
  name: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
  },
  code: { fontFamily: Typography.font.regular, fontSize: 12, marginTop: 2 },
  check: { get color() { return accent.primary; }, fontSize: 16, fontWeight: 'bold' },
});