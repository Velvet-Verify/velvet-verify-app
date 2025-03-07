// components/ui/HealthStatusArea.tsx
import React from 'react';
import { FlatList, View, Text } from 'react-native';
import { HealthStatusCard } from './HealthStatusCard';
import { useTheme } from 'styled-components/native';

type HealthStatus = {
  id: string;
  testResult?: boolean;
  testDate?: string;
  exposureStatus?: boolean;
  exposureDate?: string;
};

type HealthStatusAreaProps = {
  statuses: HealthStatus[];
};

export function HealthStatusArea({ statuses }: HealthStatusAreaProps) {
  const theme = useTheme();
  if (statuses.length === 0) {
    return <Text>No health statuses available.</Text>;
  }
  return (
    <FlatList
      data={statuses}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        // Format dates assuming item.testDate and item.exposureDate are ISO strings or numbers.
        const testDate = item.testDate ? new Date(item.testDate).toLocaleDateString() : 'N/A';
        const exposureDate = item.exposureDate ? new Date(item.exposureDate).toLocaleDateString() : 'N/A';
        const testResult = typeof item.testResult === 'boolean' ? (item.testResult ? 'Positive' : 'Negative') : 'Not Tested';
        const exposure = typeof item.exposureStatus === 'boolean' ? (item.exposureStatus ? 'Exposed' : 'Not Exposed') : 'Not Exposed';

        return (
          <HealthStatusCard
            sti={item.id}
            testResult={testResult}
            testDate={testDate}
            exposure={exposure}
            exposureDate={exposureDate}
          />
        );
      }}
    />
  );
}
