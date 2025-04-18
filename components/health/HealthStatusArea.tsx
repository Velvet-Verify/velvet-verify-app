import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from 'styled-components/native';
import { HealthStatusCard } from './HealthStatusCard';
import { ThemedButton } from '@/components/ui/ThemedButton';

type STI = { id: string; name?: string; windowPeriodMax?: number };

type HealthStatus = {
  id: string;
  testResult?: boolean;
  testDate?: any;
  exposureStatus?: boolean;
  exposureDate?: any;
};

interface Props {
  stdis: STI[];
  statuses: Record<string, HealthStatus> | null;
  hideExposure?: boolean;
  onSubmitTest?: () => void;
}

export function HealthStatusArea({
  stdis,
  statuses,
  hideExposure,
  onSubmitTest,
}: Props) {
  const theme = useTheme();

  if (!stdis || stdis.length === 0) {
    return <Text style={theme.bodyText}>No STDIs available.</Text>;
  }

  return (
    <View style={{ width: '100%' }}>
      {stdis.map((stdi) => {
        const status = statuses?.[stdi.id] ?? {};
        const testResult =
          typeof status.testResult === 'boolean'
            ? status.testResult
              ? 'Positive'
              : 'Negative'
            : 'Not Tested';

        const exposure =
          typeof status.exposureStatus === 'boolean'
            ? status.exposureStatus
              ? 'Exposed'
              : 'Not Exposed'
            : 'Not Exposed';

        const exposureDate = exposure === 'Exposed' ? status.exposureDate : null;

        return (
          <HealthStatusCard
            key={stdi.id}
            name={stdi.name || stdi.id}
            testResult={testResult}
            testDate={status.testDate ?? null}
            exposure={hideExposure ? 'Hidden' : exposure}
            exposureDate={hideExposure ? null : exposureDate}
            windowPeriodMax={stdi.windowPeriodMax ?? 0}
          />
        );
      })}

      {onSubmitTest && (
        <View style={{ marginTop: 24, alignItems: 'center' }}>
          <ThemedButton
            title="Submit Test Results"
            variant="primary"
            onPress={onSubmitTest}
            style={{ width: '100%' }}
          />
        </View>
      )}
    </View>
  );
}