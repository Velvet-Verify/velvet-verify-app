// components/health/HealthStatusArea.tsx
import React, { useState, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from 'styled-components/native';
import HealthStatusDetails from './HealthStatusDetails';
import { HealthStatusCard } from './HealthStatusCard';
import { ThemedButton } from '@/components/ui/ThemedButton';

export type STI = {
  id: string;
  name?: string;
  description?: string;
  windowPeriodMax?: number;
  treatmentPeriodMin?: number;
};

export type HealthStatus = {
  healthStatus?: number; // 0‑3 (spec)
  statusDate?: any;
};

interface Props {
  stdis: STI[];
  statuses: Record<string, HealthStatus> | null;
  showFullDates?: boolean;
  onSubmitTest?: () => void;
}

const STATUS_PRIORITY: Record<number, number> = {
  3: 0, // Positive
  2: 1, // Exposed
  0: 2, // Not Tested (explicit 0)
  1: 3, // Negative
};

function getPriority(code?: number): number {
  if (code == null) return 2; // treat undefined as Not Tested
  return STATUS_PRIORITY[code] ?? 4;
}

export function HealthStatusArea({ stdis, statuses, showFullDates = true, onSubmitTest }: Props) {
  const theme = useTheme();
  const [openId, setOpenId] = useState<string | null>(null);

  const sortedStdis = useMemo(() => {
    return [...stdis].sort((a, b) => {
      const priA = getPriority(statuses?.[a.id]?.healthStatus);
      const priB = getPriority(statuses?.[b.id]?.healthStatus);
      if (priA !== priB) return priA - priB;
      // secondary: alphabetical name
      return (a.name || a.id).localeCompare(b.name || b.id);
    });
  }, [stdis, statuses]);

  if (!sortedStdis.length) return <Text style={theme.bodyText}>No STDIs available.</Text>;

  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <View style={{ width: '100%' }}>
      {sortedStdis.map((stdi) => {
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
          <ThemedButton title="Submit Test Results" variant="primary" onPress={onSubmitTest} style={{ width: '100%' }} />
        </View>
      )}
    </View>
  );
}
