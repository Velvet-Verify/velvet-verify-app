// components/connections/ConnectionLevelChange.tsx
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from 'styled-components/native';
import { ThemedButton } from '@/components/ui/ThemedButton';
import { Connection } from './ConnectionDetailsModal';
import { useLookups } from '@/src/context/LookupContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '@/src/firebase/config';

interface Props {
  connection: Connection;
  onCancel: () => void;
  onLevelChanged: (newLevel: number) => void;
  /** Call this to open the Disconnect flow */
  onDisconnect: () => void;
}

export function ConnectionLevelChange({
  connection,
  onCancel,
  onLevelChanged,
  onDisconnect,
}: Props) {
  const theme = useTheme();
  const { connectionLevels } = useLookups();
  const fns = getFunctions(firebaseApp);
  const updateConnectionLevelCF = httpsCallable(fns, 'updateConnectionLevel');

  const currentLevel = connection.connectionLevel;

  /** Map the spec you gave → array of option objects */
  const options = useMemo<
    ({ kind: 'level'; level: number } | { kind: 'disconnect' })[]
  >(() => {
    switch (currentLevel) {
      case 2:
        return [
          { kind: 'level', level: 5 },
          { kind: 'level', level: 4 },
          { kind: 'level', level: 3 },
          { kind: 'disconnect' },
        ];
      case 3:
        return [
          { kind: 'level', level: 5 },
          { kind: 'level', level: 4 },
          { kind: 'disconnect' },
        ];
      case 4:
        return [
          { kind: 'level', level: 5 },
          { kind: 'level', level: 3 },
          { kind: 'disconnect' },
        ];
      case 5:
        return [
          { kind: 'level', level: 4 },
          { kind: 'level', level: 3 },
          { kind: 'disconnect' },
        ];
      default:
        return [];
    }
  }, [currentLevel]);

  function getLevelName(level: number) {
    return connectionLevels[String(level)]?.name ?? `Level ${level}`;
  }

  async function handleSelectLevel(level: number) {
    if (!connection.connectionDocId) return;

    await updateConnectionLevelCF({
      docId: connection.connectionDocId,
      currentLevel,
      newLevel: level,
    });

    onLevelChanged(level);
  }

  return (
    <View style={theme.centerContainer}>
      <Text style={theme.title}>Change Connection Type</Text>
      {/* <Text style={theme.bodyText}>Current: {getLevelName(currentLevel)}</Text> */}

      {options.map((opt, idx) =>
        opt.kind === 'level' ? (
          <View key={idx} style={{ marginVertical: 5, width: '100%' }}>
            <ThemedButton
              title={`Convert to ${getLevelName(opt.level)}`}
              variant="primary"
              onPress={() => handleSelectLevel(opt.level)}
            />
          </View>
        ) : (
          <View key={idx} style={{ marginVertical: 5, width: '100%' }}>
            <ThemedButton
              title="Disconnect"
              variant="secondary"
              onPress={onDisconnect}
            />
          </View>
        ),
      )}

      <View style={{ marginTop: 20, width: '100%' }}>
        <ThemedButton title="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    </View>
  );
}