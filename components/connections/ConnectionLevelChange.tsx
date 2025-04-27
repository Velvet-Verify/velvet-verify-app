// components/connections/ConnectionLevelChange.tsx
import React, { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from 'styled-components/native';
import { ThemedButton } from '@/components/ui/ThemedButton';
import { Connection } from './ConnectionDetailsModal';
import { useLookups } from '@/src/context/LookupContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '@/src/firebase/config';

interface Props {
  connection: Connection;
  onCancel: () => void;                    // closes the modal
  onLevelChanged: (newLevel: number) => void;
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
  const [submitting, setSubmitting]   = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  /* ---------- build option list ---------- */
  const options = useMemo<
    ({ kind: 'level'; level: number } | { kind: 'disconnect' })[]
  >(() => {
    switch (currentLevel) {
      case 2: return [
        { kind: 'level', level: 5 },
        { kind: 'level', level: 4 },
        { kind: 'level', level: 3 },
        { kind: 'disconnect' },
      ];
      case 3: return [
        { kind: 'level', level: 5 },
        { kind: 'level', level: 4 },
        { kind: 'disconnect' },
      ];
      case 4: return [
        { kind: 'level', level: 5 },
        { kind: 'level', level: 3 },
        { kind: 'disconnect' },
      ];
      case 5: return [
        { kind: 'level', level: 4 },
        { kind: 'level', level: 3 },
        { kind: 'disconnect' },
      ];
      default: return [];
    }
  }, [currentLevel]);

  function getLevelName(level: number) {
    return connectionLevels[String(level)]?.name ?? `Level ${level}`;
  }

  /* ---------- main handler ---------- */
  async function handleSelectLevel(level: number) {
    if (submitting || !connection.connectionDocId) return;
    setSubmitting(true);
  
    // Close the ConnectionDetailsModal first; parent screen stays visible
    onCancel();
  
    // Ask the parent to re-pull connections so the row flips to
    // “Elevation Request Sent”
    onLevelChanged(level);
  
    try {
      await updateConnectionLevelCF({
        docId: connection.connectionDocId,
        currentLevel,
        newLevel: level,
      });
      // Success – nothing else to do
    } catch {
      // We don’t care whether it was the duplicate-guard error or
      // a genuine network hiccup; the user has already left this view.
      // Log silently to keep console noise if you want:
      // console.warn('updateConnectionLevel error', err);
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- UI ---------- */
  if (requestSent) {
    return (
      <View style={theme.centerContainer}>
        <Text style={theme.modalTitle}>Request Sent</Text>
        <Text style={theme.bodyText}>
          Your elevation request has been sent.
        </Text>

        <View style={{ marginTop: 20, width: '100%' }}>
          <ThemedButton
            title="Close"
            variant="primary"
            onPress={onCancel}   // close modal → back to list
          />
        </View>
      </View>
    );
  }

  return (
    <View style={theme.centerContainer}>
      <Text style={theme.title}>Change Connection Type</Text>

      {options.map((opt, idx) =>
        opt.kind === 'level' ? (
          <View key={idx} style={{ marginVertical: 5, width: '100%' }}>
            <ThemedButton
              title={`Convert to ${getLevelName(opt.level)}`}
              variant="primary"
              disabled={submitting}
              onPress={() => handleSelectLevel(opt.level)}
            />
          </View>
        ) : (
          <View key={idx} style={{ marginVertical: 5, width: '100%' }}>
            <ThemedButton
              title="Disconnect"
              variant="secondary"
              disabled={submitting}
              onPress={onDisconnect}
            />
          </View>
        ),
      )}

      <View style={{ marginTop: 20, width: '100%' }}>
        <ThemedButton
          title="Cancel"
          variant="secondary"
          disabled={submitting}
          onPress={onCancel}
        />
      </View>
    </View>
  );
}