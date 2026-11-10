import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Keyboard } from 'react-native';
import { useSelector } from 'react-redux';
import { getServiceFields } from '../util/serviceFields';
import { accent } from '../theme/accent';
import { sanitizeDecimal } from '../util/numberInput';
import { useServiceOptions, addCustomServiceOption } from '../util/methods/useServiceOptions';
import SuggestionDropdown from './ui/SuggestionDropdown';
import { filterOptions } from '../util/filterOptions';
import { DropdownAnchor } from './ui/DropdownHost';
import { catalogId } from '../util/methods/useBrands';

// Autocomplete under a text field that has a `suggest` list. Its own
// component so the list hook runs per field; the list loads on first open.
const FieldSuggestions = ({ field, value, parentValue, parentLabel, open, serviceName, onSelect }) => {
  const { addLabel, dependsOn } = field.suggest;
  // A dependent list (tire models) is per parent value (tire brand).
  const parent = String(parentValue ?? '').trim().replace(/\s+/g, ' ');
  const list = dependsOn ? (parent ? `${field.suggest.list}_${catalogId(parent)}` : null) : field.suggest.list;
  const options = useServiceOptions(list, open);
  const userEmail = useSelector(state => state.user.userEmail);
  if (!open) return null;

  // "Model" → "models"; abbreviations like "Part no." stay as they are.
  const plural = /\.$/.test(addLabel) ? addLabel.toLowerCase() : `${addLabel.toLowerCase()}s`;
  if (dependsOn && !parent) {
    return <SuggestionDropdown hint={`Choose the ${parentLabel.toLowerCase()} first to see its ${plural}.`} />;
  }
  if (dependsOn && !value.trim() && options.length === 0) {
    return <SuggestionDropdown hint={`No ${parent} ${plural} listed yet — type one to add it.`} />;
  }

  const q = value.trim().toLowerCase();
  const matches = filterOptions(options, q);
  // Nothing to suggest once the field holds exactly the only match.
  const items = matches.length === 1 && matches[0].toLowerCase() === q ? [] : matches;

  return (
    <SuggestionDropdown
      items={items}
      query={value}
      known={options}
      onSelect={onSelect}
      onAdd={() => {
        addCustomServiceOption(list, value, {
          service: serviceName,
          field: field.key,
          parent: dependsOn ? parent : null,
          userEmail,
        });
        onSelect(value.trim().replace(/\s+/g, ' '));
      }}
      addLabel={addLabel}
    />
  );
};

// Renders the detail fields that belong to the chosen service type
// (see util/serviceFields.js). Shared by AddService and ServiceUpdate, which
// wrap their form in a DropdownHost so suggestion lists float over the form.
//
// colors: { text, label, muted, placeholder, inputBg, border,
//           borderFocus, borderFilled, chipBg, chipBorder, chipText }
//
// AddDocument / DocumentUpdate reuse it with `fields` (from
// util/documentFields.js) in place of the service lookup.
const ServiceDetailFields = ({ serviceName, fields: fieldsProp, values, onChange, colors, style }) => {
  const [focused, setFocused] = useState(null);
  // Field whose suggestion dropdown is open (one at a time).
  const [openKey, setOpenKey] = useState(null);
  const fields = fieldsProp || getServiceFields(serviceName);
  if (!fields.length) return null;

  const renderChip = (key, label, selected, onPress) => (
    <TouchableOpacity
      key={key}
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.choice,
        {
          backgroundColor: selected ? accent.primary : colors.chipBg,
          borderColor: selected ? accent.primary : colors.chipBorder,
        },
      ]}
    >
      <Text style={[styles.choiceText, { color: selected ? '#fff' : colors.chipText }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderInput = field => {
    const value = values?.[field.key] ?? '';

    if (field.type === 'choice') {
      const options = field.options.map(o => (typeof o === 'string' ? { label: o } : o));
      // An option with `sub` is selected by its own label (side not picked
      // yet) or by any of its sub values ("Front left").
      const active = options.find(
        o => value === o.label || o.sub?.some(sub => sub.value === value),
      );
      return (
        <View style={styles.choiceGroup}>
          <View style={styles.choiceRow}>
            {options.map(option => {
              const selected = active === option;
              // Tapping the selected chip again clears it.
              return renderChip(option.label, option.label, selected, () =>
                onChange(field.key, selected ? '' : option.label),
              );
            })}
          </View>
          {active?.sub && (
            <View style={styles.subRow}>
              <Text style={[styles.subLabel, { color: colors.muted }]}>{active.label}:</Text>
              {active.sub.map(sub => {
                const selected = value === sub.value;
                return renderChip(sub.value, sub.label, selected, () =>
                  onChange(field.key, selected ? active.label : sub.value),
                );
              })}
            </View>
          )}
        </View>
      );
    }

    const isNumber = field.type === 'number';
    const isMultiline = field.type === 'multiline';
    const suggestionsOpen = !!field.suggest && openKey === field.key;
    return (
      <DropdownAnchor
        open={suggestionsOpen}
        dropdown={
          suggestionsOpen ? (
            <FieldSuggestions
              field={field}
              value={String(value)}
              parentValue={field.suggest.dependsOn ? values?.[field.suggest.dependsOn] : null}
              parentLabel={fields.find(f => f.key === field.suggest.dependsOn)?.label || ''}
              open
              serviceName={serviceName}
              onSelect={item => {
                onChange(field.key, item);
                setOpenKey(null);
                Keyboard.dismiss();
              }}
            />
          ) : null
        }
      >
        <View style={styles.suffixWrapper}>
          <TextInput
            value={String(value)}
            onChangeText={v => {
              onChange(field.key, isNumber ? sanitizeDecimal(v) : v);
              if (field.suggest) setOpenKey(field.key);
            }}
            onFocus={() => {
              setFocused(field.key);
              setOpenKey(field.suggest ? field.key : null);
            }}
            onBlur={() => {
              setFocused(null);
              // Delayed so a tap on a suggestion lands before the list closes.
              setTimeout(() => setOpenKey(k => (k === field.key ? null : k)), 150);
            }}
            keyboardType={isNumber ? 'decimal-pad' : 'default'}
            multiline={isMultiline}
            textAlignVertical={isMultiline ? 'top' : 'center'}
            placeholder={field.placeholder}
            placeholderTextColor={colors.placeholder}
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.inputBg,
                borderColor:
                  focused === field.key
                    ? colors.borderFocus
                    : String(value).trim() !== ''
                    ? colors.borderFilled
                    : colors.border,
              },
              isMultiline && styles.multiline,
              field.suffix && { paddingRight: 44 },
            ]}
          />
          {!!field.suffix && (
            <Text style={[styles.suffix, { color: colors.muted }]}>{field.suffix}</Text>
          )}
        </View>
      </DropdownAnchor>
    );
  };

  return (
    <View style={[styles.section, style]}>
      <Text style={[styles.title, { color: colors.muted }]}>
        {serviceName.trim().toUpperCase()} DETAILS
      </Text>
      <View style={styles.wrap}>
        {fields.map(field => (
          <View key={field.key} style={field.full ? styles.fullField : styles.halfField}>
            <Text style={[styles.label, { color: colors.label }]}>{field.label}</Text>
            {renderInput(field)}
          </View>
        ))}
      </View>
    </View>
  );
};

export default ServiceDetailFields;

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  title: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed500',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 14 },
  halfField: { flexBasis: '46%', flexGrow: 1 },
  fullField: { flexBasis: '100%' },
  label: { fontSize: 13, fontFamily: 'RobotoCondensed500', marginBottom: 8 },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'RobotoCondensed400',
  },
  multiline: { height: 84, paddingTop: 12 },
  suffixWrapper: { position: 'relative', justifyContent: 'center' },
  suffix: {
    position: 'absolute',
    right: 14,
    fontSize: 13,
    fontFamily: 'RobotoCondensed400',
  },
  choiceGroup: { gap: 10 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  subLabel: { fontSize: 13, fontFamily: 'RobotoCondensed500' },
  choice: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
  },
  choiceText: { fontSize: 13, fontFamily: 'RobotoCondensed500' },
});
