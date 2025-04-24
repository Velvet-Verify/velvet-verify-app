// components/health/HealthStatusCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'styled-components/native';
import { ResultIcon, ResultType } from '../ui/ResultIcon';

export type CardResult = 'Positive' | 'Negative' | 'Exposed' | 'Not Tested';

interface Props {
  name: string;
  testResult: CardResult;
  statusDate: any;                // real date, Timestamp, or masked string
  windowPeriodMax: number;
  /** If true, suppresses the bottom divider so the card can be reused inside a detail pane. */
  hideBorder?: boolean;
}

const MASKED = ['Last 90 Days', 'Last 180 Days', 'Last Year', 'Over 1 Year'];

function formatDate(val: any): string {
  if (!val) return 'N/A';
  if (typeof val === 'string') {
    if (MASKED.includes(val.replace(/\u00A0/g, ' '))) return val.replace(/\u00A0/g, ' ');
    const d = new Date(val);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
  }
  if (val?.seconds !== undefined) return new Date(val.seconds * 1000).toLocaleDateString();
  if (typeof val.toDate === 'function') return val.toDate().toLocaleDateString();
  const d = new Date(val);
  return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
}

export function HealthStatusCard({
  name,
  testResult,
  statusDate,
  windowPeriodMax,
  hideBorder,
}: Props) {
  const theme = useTheme();

  const base: ResultType =
    testResult === 'Positive'
      ? 'positive'
      : testResult === 'Negative'
      ? 'negative'
      : 'notTested';

  const isExposed = testResult === 'Exposed';
  const caution = isExposed && base !== 'positive';

  return (
    <View style={[styles.card, hideBorder && styles.noBorder]}>      
      <View style={styles.row}>
        <View style={styles.textCol}>
          <Text style={[styles.name, { color: theme.title.color }]}>{name}</Text>

          {testResult === 'Not Tested' && (
            <Text style={styles.label}>Test Date: Not Tested</Text>
          )}
          {(testResult === 'Negative' || testResult === 'Positive') && statusDate && (
            <Text style={styles.label}>Last Tested: {formatDate(statusDate)}</Text>
          )}
          {testResult === 'Exposed' && statusDate && (
            <Text style={styles.label}>Exposure Date: {formatDate(statusDate)}</Text>
          )}
        </View>

        <ResultIcon result={base} active caution={caution} onPress={() => {}} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderBottomWidth: 1,
    borderColor: '#eee',
    marginRight: 10,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  textCol: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold' },
  label: { fontSize: 14, color: '#555', marginBottom: 2 },
});
