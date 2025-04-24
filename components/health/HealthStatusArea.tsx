// components/health/HealthStatusArea.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from 'styled-components/native';
import HealthStatusDetails from './HealthStatusDetails'
import { HealthStatusCard } from './HealthStatusCard';
import { ThemedButton } from '@/components/ui/ThemedButton';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */
type STI = {
  id: string;
  name?: string;
  description?: string;
  windowPeriodMax?: number;
  treatmentPeriodMin?: number;
};

type HealthStatus = {
  healthStatus?: number;
  statusDate?: any;
};

interface Props {
  stdis: STI[];
  /** keyed by STDI id */
  statuses: Record<string, HealthStatus> | null;
  /** if omitted, defaults to true (show real dates) */
  showFullDates?: boolean;
  /** supply to render a global "Submit Test" footer button (own view only) */
  onSubmitTest?: () => void;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */
export function HealthStatusArea({
  stdis,
  statuses,
  showFullDates = true,
  onSubmitTest,
}: Props) {
  const theme = useTheme();
  const [openId, setOpenId] = useState<string | null>(null);

  if (!stdis || stdis.length === 0) {
    return <Text style={theme.bodyText}>No STDIs available.</Text>;
  }

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <View style={{ width: '100%' }}>
      {stdis.map((stdi) => {
        const s = statuses?.[stdi.id] ?? {};
        const isOpen = openId === stdi.id;

        /* map numeric code → string for card */
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
          <TouchableOpacity key={stdi.id} activeOpacity={0.7} onPress={() => toggle(stdi.id)}>
            <HealthStatusCard
              name={stdi.name || stdi.id}
              testResult={testResult}
              statusDate={s.statusDate ?? null}
              windowPeriodMax={stdi.windowPeriodMax ?? 0}
            />
          </TouchableOpacity>
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
