// components/ui/HealthStatusArea.tsx

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
};

export function HealthStatusArea({ stdis, statuses }: HealthStatusAreaProps) {
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
          // Find the matching health status entry in `statuses` (if any).
          const status = statuses && statuses[item.id] ? statuses[item.id] : {};

          // Convert boolean => "Positive"/"Negative"/"Not Tested"
          const testResult =
            typeof status.testResult === 'boolean'
              ? (status.testResult ? 'Positive' : 'Negative')
              : 'Not Tested';

          // If no exposure status, default to "Not Exposed".
          const exposure =
            typeof status.exposureStatus === 'boolean'
              ? (status.exposureStatus ? 'Exposed' : 'Not Exposed')
              : 'Not Exposed';

          // Only show exposure date if truly exposed.
          const exposureDate = (exposure === 'Exposed') ? status.exposureDate : null;

          return (
            <HealthStatusCard
              // Use Firestore’s name if present, else fallback to the STDI id
              name={item.name || item.id}
              testResult={testResult}
              testDate={status.testDate ?? null}
              exposure={exposure}
              exposureDate={exposureDate}
              /* Here's the important part: pass windowPeriodMax from the STDI doc */
              windowPeriodMax={item.windowPeriodMax ?? 0}
            />
          );
        }}
      />
    </View>
  );
}
