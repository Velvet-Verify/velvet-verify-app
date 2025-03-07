// components/SubmitTestResults.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Alert,
  FlatList,
  Platform,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getFirestore, collection, addDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/src/firebase/config';
import { useAuth } from '@/src/context/AuthContext';
import { computeHSUUIDFromSUUID, computeTSUUIDFromSUUID } from '@/src/utils/hash';
import { useStdis } from '@/hooks/useStdis';
import { useTheme } from 'styled-components/native';
import { ThemedButton } from '@/components/ui/ThemedButton';
import { ResultIcon, ResultType } from '@/components/ui/ResultIcon';
import { DatePickerModal } from '@/components/ui/DatePickerModal';

type SubmitTestResultsProps = {
  onClose: () => void;
};

export default function SubmitTestResults({ onClose }: SubmitTestResultsProps) {
  const theme = useTheme();
  const { user, suuid } = useAuth();
  const router = useRouter();
  const db = getFirestore(firebaseApp);
  const { stdis, loading: stdisLoading } = useStdis();

  const [testDate, setTestDate] = useState(new Date());
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [results, setResults] = useState<{ [key: string]: ResultType }>({});
  const [submitting, setSubmitting] = useState(false);

  // Initialize results to "notTested" when STDIs load.
  useEffect(() => {
    if (!stdisLoading && stdis.length > 0) {
      const initialResults: { [key: string]: ResultType } = {};
      stdis.forEach((stdi) => {
        initialResults[stdi.id] = 'notTested';
      });
      setResults(initialResults);
    }
  }, [stdis, stdisLoading]);

  const handleSubmit = async () => {
    if (!user || !suuid) {
      Alert.alert('Error', 'User not found or not initialized.');
      return;
    }
    setSubmitting(true);
    try {
      for (const stdi of stdis) {
        const resultOption = results[stdi.id];
        if (resultOption === 'notTested') continue;
        const booleanResult = resultOption === 'positive';
        const tsuuid = await computeTSUUIDFromSUUID(suuid);

        await addDoc(collection(db, 'testResults'), {
          STDI: stdi.id,
          TSUUID: tsuuid,
          result: booleanResult,
          testDate: testDate,
        });

        const hsUUID = await computeHSUUIDFromSUUID(suuid);
        const hsDocId = `${hsUUID}_${stdi.id}`;
        const hsDocRef = doc(db, 'healthStatus', hsDocId);
        const hsDocSnap = await getDoc(hsDocRef);

        if (!hsDocSnap.exists()) {
          await setDoc(hsDocRef, {
            testResult: booleanResult,
            testDate: testDate,
          });
        } else {
          const currentTestDate = hsDocSnap.data().testDate.toDate();
          if (testDate > currentTestDate) {
            await updateDoc(hsDocRef, {
              testResult: booleanResult,
              testDate: testDate,
            });
          }
        }
      }
      Alert.alert('Success', 'Test results submitted successfully.', [
        { text: 'OK', onPress: () => onClose() },
      ]);
    } catch (error: any) {
      console.error('Error submitting test results:', error);
      Alert.alert('Error', error.message);
    }
    setSubmitting(false);
  };

  if (stdisLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.title, theme.title]}>Loading STDIs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, theme.title]}>Submit Test Results</Text>

      {/* Date row: label and Select Date button or text input on web */}
      <View style={theme.dateRow}>
        <Text style={styles.label}>Test Date: {testDate.toLocaleDateString()}</Text>
        {Platform.OS === 'web' ? (
          <TextInput
            style={[theme.input, { width: '40%' }]}
            placeholder="YYYY-MM-DD"
            value={testDate.toISOString().slice(0, 10)}
            onChangeText={(val) => {
              const [year, month, day] = val.split('-').map(Number);
              if (year && month && day) {
                setTestDate(new Date(year, month - 1, day));
              }
            }}
          />
        ) : (
          <ThemedButton
            title="Select Date"
            variant="secondary"
            onPress={() => setDatePickerVisibility(true)}
          />
        )}
      </View>
      {Platform.OS !== 'web' && (
        <DatePickerModal
          isVisible={isDatePickerVisible}
          mode="date"
          date={testDate}
          onConfirm={(date) => {
            setTestDate(date);
            setDatePickerVisibility(false);
          }}
          onCancel={() => setDatePickerVisibility(false)}
        />
      )}

      <Text style={styles.subtitle}>Select test result for each STDI:</Text>
      {stdis.length === 0 ? (
        <Text>No STDIs available.</Text>
      ) : (
        <FlatList
          data={stdis}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const currentResult = results[item.id];
            return (
              <View style={styles.itemRow}>
                <Text style={styles.itemText}>{item.id}</Text>
                <View style={styles.optionContainer}>
                  <ResultIcon
                    result="negative"
                    active={currentResult === 'negative'}
                    onPress={() =>
                      setResults((prev) => ({ ...prev, [item.id]: 'negative' }))
                    }
                  />
                  <ResultIcon
                    result="notTested"
                    active={currentResult === 'notTested'}
                    onPress={() =>
                      setResults((prev) => ({ ...prev, [item.id]: 'notTested' }))
                    }
                  />
                  <ResultIcon
                    result="positive"
                    active={currentResult === 'positive'}
                    onPress={() =>
                      setResults((prev) => ({ ...prev, [item.id]: 'positive' }))
                    }
                  />
                </View>
              </View>
            );
          }}
        />
      )}

      <View style={styles.buttonRow}>
        <ThemedButton
          title="Cancel"
          variant="secondary"
          onPress={onClose}
        />
        <ThemedButton
          title={submitting ? 'Submitting...' : 'Submit'}
          onPress={handleSubmit}
          disabled={submitting}
          variant="primary"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    padding: 20,
  },
  title: {
    // Kept minimal since theme.title is used
    marginBottom: 10,
  },
  label: {
    fontSize: 16,
    marginVertical: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 5,
  },
  itemText: {
    flex: 1,
    fontSize: 16,
  },
  optionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
});
