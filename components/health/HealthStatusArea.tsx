// components/health/HealthStatusArea.tsx
import React from 'react';
import { FlatList, Text, View } from 'react-native';
import { HealthStatusCard } from './HealthStatusCard';
import { useTheme } from 'styled-components/native';

type STI = {
  id: string;
  name?: string;
  /** The field from Firestore’s STDI doc for the max window period (e.g. 21, 35, etc.) */
  windowPeriodMax?: number;
};

type HealthStatus = {
  id: string;
  testResult?: boolean;    // true => Positive, false => Negative
  testDate?: any;         // Firestore Timestamp, Date, or null
  exposureStatus?: boolean;  // true => Exposed, false => Not Exposed
  exposureDate?: any;     // Firestore Timestamp, Date, or null
};

type HealthStatusAreaProps = {
  /** All STDI records from Firestore (via useStdis), each with windowPeriodMax */
  stdis: STI[];
  /** A dictionary of healthStatus keyed by STDI id, or null if not loaded */
  statuses: { [key: string]: HealthStatus } | null;
  /**
   * If true, hide all exposure-related data (status & date).
   * e.g. for connection level 2 or 3, we only show test result & test date.
   */
  hideExposure?: boolean;
};

export function HealthStatusArea({ stdis, statuses, hideExposure }: HealthStatusAreaProps) {
  const theme = useTheme();

  if (!stdis || stdis.length === 0) {
    return <Text>No STDIs available.</Text>;
  }

  return (
    <View style={{ width: '100%' }}>
      <FlatList
        data={stdis}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const status = statuses && statuses[item.id] ? statuses[item.id] : {};

          const testResult =
            typeof status.testResult === 'boolean'
              ? (status.testResult ? 'Positive' : 'Negative')
              : 'Not Tested';

          const exposure =
            typeof status.exposureStatus === 'boolean'
              ? (status.exposureStatus ? 'Exposed' : 'Not Exposed')
              : 'Not Exposed';

          const exposureDate = (exposure === 'Exposed') ? status.exposureDate : null;

          return (
            <HealthStatusCard
              name={item.name || item.id}
              testResult={testResult}
              testDate={status.testDate ?? null}
              exposure={hideExposure ? 'Hidden' : exposure}
              exposureDate={hideExposure ? null : exposureDate}
              windowPeriodMax={item.windowPeriodMax ?? 0}
            />
          );
        }}
      />
    </View>
  );
}