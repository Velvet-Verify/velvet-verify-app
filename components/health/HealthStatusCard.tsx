// components/ui/HealthStatusCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'styled-components/native';
import { ResultIcon, ResultType } from '../ui/ResultIcon';

type HealthStatusCardProps = {
  name: string;         // Full display name for the STDI
  testResult: string;   // "Positive", "Negative", or "Not Tested"
  testDate: any;        // Firestore Timestamp, Date, or null
  exposure: string;     // "Exposed" or "Not Exposed"
  exposureDate: any;    // Firestore Timestamp, Date, or null
  windowPeriodMax: number;  // Number of days to add to exposureDate
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

function computeTestAfterDate(exposureDate: any, windowPeriodMax: number): string {
  let dateObj: Date;
  if (typeof exposureDate === 'object' && exposureDate.seconds !== undefined) {
    dateObj = new Date(exposureDate.seconds * 1000);
  } else if (typeof exposureDate.toDate === 'function') {
    dateObj = exposureDate.toDate();
  } else {
    dateObj = new Date(exposureDate);
  }
  // Clone the date to avoid mutating the original.
  const testAfterDate = new Date(dateObj);
  testAfterDate.setDate(testAfterDate.getDate() + windowPeriodMax);
  const formattedDate = testAfterDate.toLocaleDateString();
  return formattedDate;
}

export function HealthStatusCard({
  name,
  testResult,
  testDate,
  exposure,
  exposureDate,
  windowPeriodMax,
}: HealthStatusCardProps) {
  const theme = useTheme();

  const baseResult: ResultType =
    testResult.toLowerCase() === 'positive'
      ? 'positive'
      : testResult.toLowerCase() === 'negative'
      ? 'negative'
      : 'notTested';

  const caution =
    exposure.toLowerCase() === 'exposed' && baseResult !== 'positive';

  return (
    <View style={styles.card}>
      {/* This is the row that holds our text block and the icon block */}
      <View style={styles.rowContainer}>
        <View style={styles.textContainer}>
          <Text style={[styles.name, { color: theme.title.color }]}>{name}</Text>
          {baseResult !== 'notTested' && testDate && (
            <Text style={styles.label}>
              Test Date: {formatDate(testDate)}
            </Text>
          )}
          {exposure.toLowerCase() === 'exposed' && exposureDate ? (
            <Text style={styles.label}>
              Exposed: Test After{' '}
              {computeTestAfterDate(exposureDate, windowPeriodMax)}
            </Text>
          ) : null}
        </View>

        <View style={styles.iconContainer}>
          <ResultIcon
            result={baseResult}
            active={true}
            caution={caution}
            onPress={() => {}}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    // paddingVertical: 5,
    // marginVertical: 4,
    borderBottomWidth: 1,
    borderColor: '#eee',
    marginRight: 10,
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', 
    paddingVertical: 5,
  },
  textContainer: {
    flex: 1, 
  },
  iconContainer: {
    paddingVertical: 5,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    color: '#555',
    marginBottom: 2,
  },
});