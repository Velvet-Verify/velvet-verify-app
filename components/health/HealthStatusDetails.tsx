// ============================================================================
// components/health/HealthStatusDetails.tsx
// ----------------------------------------------------------------------------
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useTheme } from 'styled-components/native';
import { HealthStatusCard, CardResult } from './HealthStatusCard';

const MASKED = ['Last 90 Days', 'Last 180 Days', 'Last Year', 'Over 1 Year'];
const isMasked = (v: any) => typeof v === 'string' && MASKED.includes(v.replace(/\u00A0/g, ' '));

function formatDate(v: any): string {
  if (!v) return 'N/A';
  if (typeof v === 'string') return isMasked(v) ? v.replace(/\u00A0/g, ' ') : new Date(v).toLocaleDateString();
  if (v?.seconds !== undefined) return new Date(v.seconds * 1000).toLocaleDateString();
  if (typeof v.toDate === 'function') return v.toDate().toLocaleDateString();
  const d = new Date(v);
  return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
}
const addDays = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString();
};
const calcEnd = (base: any, days: number) => (!base || !days ? null : addDays(new Date(base?.seconds ? base.seconds * 1000 : base), days));
const healthLabel = (c?: number) => (c === 1 ? 'Negative' : c === 2 ? 'Exposed' : c === 3 ? 'Positive' : 'Not Tested');

export interface STI { id: string; name?: string; description?: string; windowPeriodMax?: number; treatmentPeriodMin?: number }
export interface HealthStatus { healthStatus?: number; statusDate?: any }
interface Props { stdi: STI; status: HealthStatus; showFullDates: boolean; onClose: () => void }

export default function HealthStatusDetails({ stdi, status, showFullDates, onClose }: Props) {
  const theme = useTheme();
  const { windowPeriodMax, treatmentPeriodMin } = stdi;
  const statusDate = status.statusDate;
  const windowEnd = status.healthStatus === 2 && windowPeriodMax ? calcEnd(statusDate, windowPeriodMax) : null;
  const treatmentEnd = status.healthStatus === 3 && treatmentPeriodMin ? calcEnd(statusDate, treatmentPeriodMin) : null;
  const hideEnd = !showFullDates || isMasked(statusDate);

  let result: CardResult = 'Not Tested';
  switch (status.healthStatus) {
    case 1:
      result = 'Negative';
      break;
    case 2:
      result = 'Exposed';
      break;
    case 3:
      result = 'Positive';
      break;
  }

  return (
    <View style={styles.wrapper}>
      {/* Tap header again to collapse */}
      <Pressable android_ripple={{ color: '#ddd' }} onPress={onClose}>
        <HealthStatusCard
          name={stdi.name || stdi.id}
          testResult={result}
          statusDate={statusDate ?? null}
          windowPeriodMax={windowPeriodMax ?? 0}
          hideBorder
        />
      </Pressable>

      <ScrollView style={{ marginTop: 6 }}>
        <Text style={[theme.bodyText, styles.description]}>{stdi.description || 'No description available.'}</Text>

        {windowPeriodMax != null && (
          <>
            <Text style={theme.bodyText}><Text style={styles.bold}>Window Period:</Text> {windowPeriodMax} days</Text>
            <Text style={[theme.bodyText, styles.explanation]}>The window period is the time from exposure until the infection can reliably be detected in a test. Your status will stay “Exposed” until you test again after this period ends.</Text>
          </>
        )}
        {!hideEnd && windowEnd && <Text style={theme.bodyText}><Text style={styles.bold}>Window Period End:</Text> {windowEnd}</Text>}

        <View style={styles.spacer} />

        <Text style={theme.bodyText}><Text style={styles.bold}>Treatment Period:</Text> {treatmentPeriodMin != null ? `${treatmentPeriodMin} days` : 'N/A'}</Text>
        <Text style={[theme.bodyText, styles.explanation]}>The treatment period is the minimum time after starting medication that the infection typically needs to clear your body. Your status will remain “Positive” until this period has passed and you retest to confirm the infection is gone.</Text>
        {!hideEnd && treatmentEnd && <Text style={theme.bodyText}><Text style={styles.bold}>Treatment Period End:</Text> {treatmentEnd}</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 8, marginRight: 10 },
  description: { marginBottom: 8 },
  bold: { fontWeight: 'bold' },
  spacer: { height: 12 },
  explanation: { marginBottom: 8, fontStyle: 'italic' },
});
