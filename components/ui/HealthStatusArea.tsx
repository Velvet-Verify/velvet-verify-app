// components/ui/HealthStatusArea.tsx
import React from 'react';
import { FlatList, Text, View } from 'react-native';
import { HealthStatusCard } from './HealthStatusCard';
import { useTheme } from 'styled-components/native';

type STI = { id: string; name?: string };

type HealthStatus = {
  id: string;
  testResult?: boolean;
  testDate?: any;
  exposureStatus?: boolean;
  exposureDate?: any;
};

type HealthStatusAreaProps = {
  stdis: STI[];
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
          // Get corresponding status; default if missing.
          const status = statuses && statuses[item.id] ? statuses[item.id] : {};
          const testResult =
            typeof status.testResult === 'boolean'
              ? (status.testResult ? 'Positive' : 'Negative')
              : 'Not Tested';
          const testDate = status.testDate ? status.testDate : null;
          const exposure =
            typeof status.exposureStatus === 'boolean'
              ? (status.exposureStatus ? 'Exposed' : 'Not Exposed')
              : 'Not Exposed';
          const exposureDate = status.exposureStatus ? status.exposureDate : null;

          return (
            <HealthStatusCard
              name={item.name || item.id}
              testResult={testResult}
              testDate={testDate}
              exposure={exposure}
              exposureDate={exposureDate}
            />
          );
        }}
      />
    </View>
  );
}
