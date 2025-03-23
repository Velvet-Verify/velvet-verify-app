// component/connections/ConnectionLevelChange.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from 'styled-components/native';
import { ThemedButton } from '@/components/ui/ThemedButton';
import { Connection } from './ConnectionDetailsModal';
import { useLookups } from '@/src/context/LookupContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '@/src/firebase/config';

interface ConnectionLevelChangeProps {
  connection: Connection;
  onCancel: () => void;
  onLevelChanged: (newLevel: number) => void; 
}

export function ConnectionLevelChange({
  connection,
  onCancel,
  onLevelChanged,
}: ConnectionLevelChangeProps) {
  const theme = useTheme();
  const { connectionLevels } = useLookups();
  const functionsInstance = getFunctions(firebaseApp);
  const updateConnectionLevelCF = httpsCallable(functionsInstance, 'updateConnectionLevel');

  const currentLevel = connection.connectionLevel;
  const allLevels = [2, 3, 4];
  const selectable = allLevels.filter((l) => l !== currentLevel);

  function getLevelName(levelNumber: number) {
    const lvl = connectionLevels[String(levelNumber)];
    return lvl ? lvl.name : `Level ${levelNumber}`;
  }

  async function handleSelectLevel(newLevel: number) {
    try {
      if (!connection.connectionDocId) {
        throw new Error('No docId found on the connection object.');
      }

      // Call the CF with docId, currentLevel, newLevel:
      await updateConnectionLevelCF({
        docId: connection.connectionDocId,
        currentLevel: currentLevel,
        newLevel: newLevel,
      });

      // Once CF is successful, we might want to do something locally:
      // e.g. re-fetch data, or at least let the parent know we changed it:
      onLevelChanged(newLevel);
    } catch (err: any) {
      console.error('Error updating connection level:', err);
      // You could show a user-friendly message here
    }
  }

  return (
    <View style={theme.centerContainer}>
      <Text style={theme.title}>Change Connection Type</Text>
      <Text style={theme.bodyText}>Current: {getLevelName(currentLevel)}</Text>

      {selectable.map((level) => (
        <View key={level} style={{ marginVertical: 5 }}>
          <ThemedButton
            title={`Switch to ${getLevelName(level)}`}
            variant="primary"
            onPress={() => handleSelectLevel(level)}
          />
        </View>
      ))}

      <View style={{ marginTop: 20 }}>
        <ThemedButton title="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    </View>
  );
}