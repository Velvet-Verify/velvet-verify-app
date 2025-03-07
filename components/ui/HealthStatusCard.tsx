// components/ui/HealthStatusCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'styled-components/native';

type HealthStatusCardProps = {
  sti: string;
  testResult: string;
  testDate: string;
  exposure: string;
  exposureDate: string;
};

export function HealthStatusCard({ sti, testResult, testDate, exposure, exposureDate }: HealthStatusCardProps) {
  const theme = useTheme();
  return (
    <View style={[styles.card, theme.healthStatusCard]}>
      <Text style={[styles.sti, { color: theme.title.color }]}>{sti}</Text>
      <Text style={styles.label}>Result: {testResult}</Text>
      <Text style={styles.label}>Test Date: {testDate}</Text>
      <Text style={styles.label}>Exposure: {exposure}</Text>
      <Text style={styles.label}>Exposure Date: {exposureDate}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderColor: '#eee',
    marginVertical: 5,
  },
  sti: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    color: '#555',
  },
});
