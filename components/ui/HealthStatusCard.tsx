// components/ui/HealthStatusCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'styled-components/native';
import { ResultIcon } from './ResultIcon';

type HealthStatusCardProps = {
  name: string;         // Changed from 'sti' to 'name'
  testResult: string;   // "Positive", "Negative", or "Not Tested"
  testDate: any;        // raw timestamp, Date, or null
  exposure: string;     // "Exposed" or "Not Exposed"
  exposureDate: any;    // raw timestamp, Date, or null
};

function formatDate(dateValue: any): string {
  if (!dateValue) return 'N/A';
  if (typeof dateValue === 'object' && dateValue.seconds !== undefined) {
    return new Date(dateValue.seconds * 1000).toLocaleDateString();
  }
  if (typeof dateValue.toDate === 'function') {
    return dateValue.toDate().toLocaleDateString();
  }
  const dateObj = new Date(dateValue);
  return isNaN(dateObj.getTime()) ? 'N/A' : dateObj.toLocaleDateString();
}

export function HealthStatusCard({ name, testResult, testDate, exposure, exposureDate }: HealthStatusCardProps) {
  const theme = useTheme();

  // Determine result type for the icon.
  const resultType: 'positive' | 'negative' | 'notTested' =
    testResult.toLowerCase() === 'positive'
      ? 'positive'
      : testResult.toLowerCase() === 'negative'
      ? 'negative'
      : 'notTested';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={[styles.name, { color: theme.title.color }]}>{name}</Text>
        <ResultIcon result={resultType} active={true} onPress={() => {}} />
      </View>
      {resultType !== 'notTested' && testDate && (
        <Text style={styles.label}>Test Date: {formatDate(testDate)}</Text>
      )}
      <Text style={styles.label}>Exposure: {exposure}</Text>
      {exposure.toLowerCase() === 'exposed' && exposureDate && (
        <Text style={styles.label}>Exposure Date: {formatDate(exposureDate)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderColor: '#eee',
    marginVertical: 5,
    marginRight: 15,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    color: '#555',
  },
});
