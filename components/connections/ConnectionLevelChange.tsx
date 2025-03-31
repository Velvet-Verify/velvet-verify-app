// components/connections/ConnectionLevelChange.tsx
import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useTheme } from 'styled-components/native';
import { ThemedButton } from '@/components/ui/ThemedButton';
import { Connection } from './ConnectionDetailsModal';
import { useLookups } from '@/src/context/LookupContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '@/src/firebase/config';
import { MembershipSelectionModal } from '@/components/membership/MembershipSelectionModal';
import { useMembership } from '@/src/context/MembershipContext';

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

  const { membership } = useMembership();

  const currentLevel = connection.connectionLevel;
  const allLevels = [2, 3, 4];
  const selectable = allLevels.filter((l) => l !== currentLevel);

  // We show the membership modal if user tries to elevate without premium
  const [membershipModalVisible, setMembershipModalVisible] = useState(false);
  // Store which level they tried
  const [requestedLevel, setRequestedLevel] = useState<number | null>(null);

  function getLevelName(levelNumber: number) {
    const lvl = connectionLevels[String(levelNumber)];
    return lvl ? lvl.name : `Level ${levelNumber}`;
  }

  /**
   * Called when user picks a new level from the list
   */
  async function handleSelectLevel(newLevel: number) {
    try {
      // If newLevel > currentLevel => user is elevating
      if (newLevel > currentLevel) {
        // Check premium membership
        if (!membership?.premium) {
          // Not premium => show membership modal
          setRequestedLevel(newLevel);
          setMembershipModalVisible(true);
          return;
        }
      }

      // Otherwise proceed with the CF call
      await doConnectionLevelUpdate(newLevel);

    } catch (err: any) {
      console.error('Error updating connection level:', err);
      Alert.alert('Update Level Error', err.message || 'Could not update level.');
    }
  }

  /**
   * Actually call the CF to update the doc
   */
  async function doConnectionLevelUpdate(newLevel: number) {
    if (!connection.connectionDocId) {
      throw new Error('No docId found on the connection object.');
    }
    // Call the CF with docId, currentLevel, newLevel:
    await updateConnectionLevelCF({
      docId: connection.connectionDocId,
      currentLevel,
      newLevel,
    });

    // Let parent know we changed it
    onLevelChanged(newLevel);
  }

  /**
   * If user just upgraded to premium, we proceed with the update
   */
  async function handleUpgraded() {
    setMembershipModalVisible(false);
    if (requestedLevel !== null) {
      await doConnectionLevelUpdate(requestedLevel);
      setRequestedLevel(null);
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

      {/* This modal appears if user tries to elevate but isn't premium */}
      <MembershipSelectionModal
        visible={membershipModalVisible}
        onClose={() => setMembershipModalVisible(false)}
        onUpgraded={handleUpgraded}
      />
    </View>
  );
}