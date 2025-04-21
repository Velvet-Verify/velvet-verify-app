// components/health/HealthStatusArea.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from 'styled-components/native';
import { HealthStatusCard } from './HealthStatusCard';
import { ThemedButton } from '@/components/ui/ThemedButton';

type STI = { id: string; name?: string; windowPeriodMax?: number };

type HealthStatus = {
  healthStatus?: number;          // 0–3 codes
  statusDate?: any;               // string, Date, or Timestamp
};

interface Props {
  stdis: STI[];
  /** keyed by STDI id */
  statuses: Record<string, HealthStatus> | null;
  onSubmitTest?: () => void;
}

export function HealthStatusArea({
  stdis,
  statuses,
  onSubmitTest,
}: Props) {
  const theme = useTheme();

  if (!stdis?.length) {
    return <Text style={theme.bodyText}>No STDIs available.</Text>;
  }

  return (
    <View style={{ width: '100%' }}>
      {stdis.map((stdi) => {
        const s = statuses?.[stdi.id] ?? {};

        /* map numeric code → string */
        let testResult: 'Positive' | 'Negative' | 'Exposed' | 'Not Tested' = 'Not Tested';
        switch (s.healthStatus) {
          case 1: testResult = 'Negative'; break;
          case 2: testResult = 'Exposed';  break;
          case 3: testResult = 'Positive'; break;
        }

        return (
          <HealthStatusCard
            key={stdi.id}
            name={stdi.name || stdi.id}
            testResult={testResult}
            statusDate={s.statusDate ?? null}
            windowPeriodMax={stdi.windowPeriodMax ?? 0}
          />
        );
      })}

      {/* Submit button unchanged */}
      {onSubmitTest && (
        <View style={{ marginTop: 24, alignItems: 'center' }}>
          <ThemedButton
            title="Submit Test Results"
            variant="primary"
            onPress={onSubmitTest}
            style={{ width: '100%' }}
          />
        </View>
      )}
    </View>
  );
}