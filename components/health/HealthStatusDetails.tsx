// ============================================================================
// components/health/HealthStatusDetails.tsx
// ----------------------------------------------------------------------------
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from 'styled-components/native';
import { HealthStatusCard, CardResult } from './HealthStatusCard';

/* ----------------- helpers & types (unchanged) --------------------------------- */
const MASKED = ['Last 90 Days', 'Last 180 Days', 'Last Year', 'Over 1 Year'];
function isMasked(val: any): boolean { return typeof val === 'string' && MASKED.includes(val.replace(/\u00A0/g, ' ')); }
function formatDate(val: any): string { /* same as previous version */
  if (!val) return 'N/A';
  if (typeof val === 'string') {
    if (isMasked(val)) return val.replace(/\u00A0/g, ' ');
    const d = new Date(val);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
  }
  if (val?.seconds !== undefined) return new Date(val.seconds * 1000).toLocaleDateString();
  if (typeof val.toDate === 'function') return val.toDate().toLocaleDateString();
  const d = new Date(val);
  return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
}
function addDays(base: Date, days: number): string { const d = new Date(base); d.setDate(d.getDate() + days); return d.toLocaleDateString(); }
function calcEndDate(base: any, days: number): string | null { /* same as previous */
  if (!base || !days) return null;
  let b: Date | null = null;
  if (base?.seconds !== undefined) b = new Date(base.seconds * 1000);
  else if (typeof base.toDate === 'function') b = base.toDate();
  else { const d = new Date(base); if (!isNaN(d.getTime())) b = d; }
  return b ? addDays(b, days) : null;
}
function healthLabel(code?: number): string { switch (code) { case 1: return 'Negative'; case 2: return 'Exposed'; case 3: return 'Positive'; default: return 'Not Tested'; } }

interface STI { id: string; name?: string; description?: string; windowPeriodMax?: number; treatmentPeriodMin?: number; }
interface HealthStatus { healthStatus?: number; statusDate?: any; }
interface Props { stdi: STI; status: HealthStatus; showFullDates: boolean; onClose: () => void; }

/* ---------------------------- component --------------------------------------- */
export default function HealthStatusDetails({ stdi, status, showFullDates, onClose }: Props) {
  const theme = useTheme();
  const displayName = stdi.name || stdi.id;
  const description = stdi.description || 'No description available.';
  const statusLabel = healthLabel(status.healthStatus);
  const exposureDt = formatDate(status.statusDate);
  const windowEnd = status.healthStatus === 2 && stdi.windowPeriodMax ? calcEndDate(status.statusDate, stdi.windowPeriodMax!) : null;
  const treatmentEnd = status.healthStatus === 3 && stdi.treatmentPeriodMin ? calcEndDate(status.statusDate, stdi.treatmentPeriodMin!) : null;
  const hideEndDates = !showFullDates || isMasked(status.statusDate);

  let testResult: CardResult = 'Not Tested';
  switch (status.healthStatus) { case 1: testResult = 'Negative'; break; case 2: testResult = 'Exposed'; break; case 3: testResult = 'Positive'; break; }

  return (
    <View style={styles.wrapper}>
      <HealthStatusCard
        name={displayName}
        testResult={testResult}
        statusDate={status.statusDate ?? null}
        windowPeriodMax={stdi.windowPeriodMax ?? 0}
        hideBorder
      />

      <ScrollView style={{ marginTop: 6 }}>
        <Text style={[theme.bodyText, styles.description]}>{description}</Text>

        <View style={styles.spacer} />

        {stdi.windowPeriodMax !== undefined && (
          <>
            <Text style={theme.bodyText}>
              <Text style={styles.bold}>Window Period:</Text> {stdi.windowPeriodMax} days
            </Text>
            <Text style={[theme.bodyText, styles.explanation]}>
              The window period is the time from exposure until the infection can reliably be detected in a test. Your status will stay “Exposed” until you test again after this period ends.
            </Text>
          </>
        )}

        {!hideEndDates && windowEnd && (
          <>
            <View style={styles.spacer} />
            <Text style={theme.bodyText}>
              <Text style={styles.bold}>Window Period End:</Text> {windowEnd}
            </Text>
          </>
        )}

        <View style={styles.spacer} />

        {stdi.treatmentPeriodMin !== undefined && (
          <>
            <Text style={theme.bodyText}>
              <Text style={styles.bold}>Treatment Period:</Text> {stdi.treatmentPeriodMin} days
            </Text>
            <Text style={[theme.bodyText, styles.explanation]}>
              The treatment period is the minimum time after starting medication that the infection typically needs to clear your body. Your status will remain “Positive” until this period has passed and you retest to confirm the infection is gone.
            </Text>
          </>
        )}

        {!hideEndDates && treatmentEnd && (
          <>
            <View style={styles.spacer} />          
            <Text style={theme.bodyText}>
              <Text style={styles.bold}>Treatment Period End:</Text> {treatmentEnd}
            </Text>
          </>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
        <Text style={[theme.bodyText, { textAlign: 'center' }]}>Collapse</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 8, marginRight: 10 },
  description: { marginBottom: 8 },
  bold: { fontWeight: 'bold' },
  spacer: { height: 15 },
  explanation: { marginBottom: 6, fontStyle: 'italic' },
  closeBtn: { marginTop: 12, paddingVertical: 6, alignSelf: 'flex-start' },
});