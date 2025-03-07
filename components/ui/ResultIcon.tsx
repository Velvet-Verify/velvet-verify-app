// components/ui/ResultIcon.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

export type ResultType = 'positive' | 'negative' | 'notTested';

interface ResultIconProps {
  result: ResultType;
  active: boolean;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function ResultIcon({ result, active, onPress, style, textStyle }: ResultIconProps) {
  let selectedStyle;
  switch (result) {
    case 'negative':
      selectedStyle = active ? styles.negativeSelected : styles.unselectedOption;
      break;
    case 'positive':
      selectedStyle = active ? styles.positiveSelected : styles.unselectedOption;
      break;
    case 'notTested':
      selectedStyle = active ? styles.notTestedSelected : styles.unselectedOption;
      break;
  }

  const displayText = result === 'negative' ? '–' : result === 'positive' ? '+' : '○';

  return (
    <TouchableOpacity onPress={onPress} style={[styles.optionButton, selectedStyle, style]}>
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
