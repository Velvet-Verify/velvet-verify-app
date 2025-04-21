// components/health/HealthStatusCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'styled-components/native';
import { ResultIcon, ResultType } from '../ui/ResultIcon';

type Props = {
  name: string;
  /** 'Exposed' is now treated as its own result */
  testResult: 'Positive' | 'Negative' | 'Exposed' | 'Not Tested';
  /** Real date, Firestore Timestamp, or masked string (“Last 90 Days”, …) */
  statusDate: any;
  /** Max window‑period in days for this STDI (needed to show “test after …”) */
  windowPeriodMax: number;
};

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

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString();
}

export function HealthStatusCard({
  name,
  testResult,
  statusDate,
  windowPeriodMax,
}: Props) {
  const theme = useTheme();

  const base: ResultType =
    testResult === 'Positive'
      ? 'positive'
      : testResult === 'Negative'
      ? 'negative'
      : 'notTested';

  const isExposed = testResult === 'Exposed';
  const caution   = isExposed && base !== 'positive';

  /* ---- compute “test after …” for exposures ---- */
  let testAfterStr: string | null = null;
  if (isExposed && statusDate && windowPeriodMax > 0) {
    let baseDate: Date | null = null;
    if (statusDate?.seconds !== undefined) baseDate = new Date(statusDate.seconds * 1000);
    else if (typeof statusDate.toDate === 'function') baseDate = statusDate.toDate();
    else {
      const d = new Date(statusDate);
      if (!isNaN(d.getTime())) baseDate = d;
    }
    if (baseDate) testAfterStr = addDays(baseDate, windowPeriodMax);
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.textCol}>
          <Text style={[styles.name, { color: theme.title.color }]}>{name}</Text>

          {/* ---- conditional labels ---- */}
          {testResult === 'Not Tested' && (
            <Text style={styles.label}>Test Date: Not Tested</Text>
          )}

          {(testResult === 'Negative' || testResult === 'Positive') && statusDate && (
            <Text style={styles.label}>Last Tested: {formatDate(statusDate)}</Text>
          )}

          {testResult === 'Exposed' && statusDate && (
            <Text style={styles.label}>Exposure Date: {formatDate(statusDate)}</Text>
          )}

          {testAfterStr && (
            <Text style={styles.label}>Exposed - test after {testAfterStr}</Text>
          )}
        </View>

        <ResultIcon result={base} active caution={caution} onPress={() => {}} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderBottomWidth: 1, borderColor: '#eee', marginRight: 10 },
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