// components/health/HealthStatusArea.tsx
import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from 'styled-components/native';
import HealthStatusDetails from './HealthStatusDetails';
import { HealthStatusCard } from './HealthStatusCard';
import { ThemedButton } from '@/components/ui/ThemedButton';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */
export type STI = {
  id: string;
  name?: string;
  description?: string;
  windowPeriodMax?: number;
  treatmentPeriodMin?: number;
};

export type HealthStatus = {
  healthStatus?: number;
  statusDate?: any;
};

interface Props {
  stdis: STI[];
  statuses: Record<string, HealthStatus> | null;
  showFullDates?: boolean;
  onSubmitTest?: () => void;
}

export function HealthStatusArea({ stdis, statuses, showFullDates = true, onSubmitTest }: Props) {
  const theme = useTheme();
  const [openId, setOpenId] = useState<string | null>(null);
  if (!stdis?.length) return <Text style={theme.bodyText}>No STDIs available.</Text>;

  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <View style={{ width: '100%' }}>
      {stdis.map((stdi) => {
        const s = statuses?.[stdi.id] ?? {};
        const isOpen = openId === stdi.id;
        let testResult: 'Positive' | 'Negative' | 'Exposed' | 'Not Tested' = 'Not Tested';
        switch (s.healthStatus) {
          case 1:
            testResult = 'Negative';
            break;
          case 2:
            testResult = 'Exposed';
            break;
          case 3:
            testResult = 'Positive';
            break;
        }

        return isOpen ? (
          <HealthStatusDetails
            key={`${stdi.id}-details`}
            stdi={stdi}
            status={s}
            showFullDates={showFullDates}
            onClose={() => toggle(stdi.id)}
          />
        ) : (
          <Pressable
            key={stdi.id}
            android_ripple={{ color: '#ddd' }}
            onPress={() => toggle(stdi.id)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <HealthStatusCard
              name={stdi.name || stdi.id}
              testResult={testResult}
              statusDate={s.statusDate ?? null}
              windowPeriodMax={stdi.windowPeriodMax ?? 0}
            />
          </Pressable>
        );
      })}

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
