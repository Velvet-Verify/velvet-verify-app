// components/ui/ResultIcon.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

export type ResultType = 'positive' | 'negative' | 'notTested';

interface ResultIconProps {
  result: ResultType;
  active: boolean;
  caution?: boolean;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function ResultIcon({ result, active, caution = false, onPress, style, textStyle }: ResultIconProps) {
  // Determine display text based on the base result.
  const displayText = result === 'negative' ? '–' : result === 'positive' ? '+' : '○';

  // If caution is true (i.e. exposure is "exposed" and result isn’t positive), use amber style.
  const computedStyle =
    caution && (result === 'negative' || result === 'notTested')
      ? styles.amberSelected
      : result === 'negative'
      ? active
        ? styles.negativeSelected
        : styles.unselectedOption
      : result === 'positive'
      ? active
        ? styles.positiveSelected
        : styles.unselectedOption
      : result === 'notTested'
      ? active
        ? styles.notTestedSelected
        : styles.unselectedOption
      : styles.unselectedOption;

  return (
    <TouchableOpacity onPress={onPress} style={[styles.optionButton, computedStyle, style]}>
      <Text style={[styles.optionText, active ? styles.selectedText : styles.unselectedText, textStyle]}>
        {displayText}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  optionButton: {
    marginHorizontal: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
  negativeSelected: {
    backgroundColor: 'green',
    borderColor: 'green',
  },
  positiveSelected: {
    backgroundColor: 'red',
    borderColor: 'red',
  },
  notTestedSelected: {
    backgroundColor: 'gray',
    borderColor: 'gray',
  },
  // New amber style for cautionary cases
  amberSelected: {
    backgroundColor: '#FFBF00', // amber color
    borderColor: '#FFBF00',
  },
  unselectedOption: {
    backgroundColor: 'white',
    borderColor: 'gray',
  },
  optionText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  selectedText: {
    color: 'white',
  },
  unselectedText: {
    color: 'gray',
  },
});
