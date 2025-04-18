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
import { useAuth } from '@/src/context/AuthContext';
import { useStdis } from '@/hooks/useStdis';
import { useTheme } from 'styled-components/native';

import { getFunctions, httpsCallable } from 'firebase/functions'; // Cloud function
import { firebaseApp } from '@/src/firebase/config';

import { ThemedButton } from '@/components/ui/ThemedButton';
import { ResultIcon, ResultType } from '@/components/ui/ResultIcon';
import { DatePickerModal } from '@/components/ui/DatePickerModal';

type SubmitTestResultsProps = {
  onClose: () => void;
};

/**
 * This screen gathers user input (STDI + result + test date),
 * then calls the 'submitTestResults' CF to handle:
 *  1) Recording new testResults for the user
 *  2) Updating user’s healthStatus
 *  3) Possibly updating bonded partners’ negative results
 */
export default function SubmitTestResults({ onClose }: SubmitTestResultsProps) {
  const theme = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  // Load STDI definitions (like "chlamydia", "gonorrhea", etc.)
  const { stdis, loading: stdisLoading } = useStdis();

  // Cloud functions setup
  const functionsInstance = getFunctions(firebaseApp);
  // We'll call the 'submitTestResults' function we wrote on the server
  const submitTestResultsCF = httpsCallable(functionsInstance, 'submitTestResults');

  // Local state for test date & picking results
  const [testDate, setTestDate] = useState(new Date());
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [results, setResults] = useState<{ [key: string]: ResultType }>({});
  const [submitting, setSubmitting] = useState(false);

  // On first load of the STDI list, initialize each as "notTested"
  useEffect(() => {
    if (!stdisLoading && stdis.length > 0) {
      const initialResults: { [key: string]: ResultType } = {};
      stdis.forEach((stdi) => {
        initialResults[stdi.id] = 'notTested';
      });
      setResults(initialResults);
    }
  }, [stdis, stdisLoading]);

  // Called when the user taps "Submit"
  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Error', 'User not found or not initialized.');
      return;
    }
    setSubmitting(true);

    try {
      // Build a payload of STDI results to send to the CF
      // We'll skip anything marked "notTested."
      const resultsToSubmit = stdis
        .filter((stdi) => results[stdi.id] !== 'notTested')
        .map((stdi) => {
          const resultOption = results[stdi.id];
          const booleanResult = resultOption === 'positive';
          return {
            stdiId: stdi.id,
            result: booleanResult,              // true=positive, false=negative
            testDate: testDate.toISOString(),   // pass ISO string to the CF
          };
        });

      if (resultsToSubmit.length === 0) {
        Alert.alert('No Results', 'Please select at least one STDI to test.');
        setSubmitting(false);
        return;
      }

      // Call the CF
      const response = await submitTestResultsCF({ results: resultsToSubmit });
      // If it returns { success: true }, we assume success
      Alert.alert('Success', 'Test results submitted successfully.', [
        { text: 'OK', onPress: () => onClose() },
      ]);
    } catch (error: any) {
      console.error('Error submitting test results:', error);
      Alert.alert('Error', error.message ?? 'Failed to submit test results.');
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

      {/* Date row: label and either 'Select Date' button (mobile) or text input (web) */}
      <View style={theme.dateRow}>
        <Text style={styles.label}>
          Test Date: {testDate.toLocaleDateString()}
        </Text>
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
                      setResults((prev) => ({
                        ...prev,
                        [item.id]: 'negative',
                      }))
                    }
                  />
                  <ResultIcon
                    result="notTested"
                    active={currentResult === 'notTested'}
                    onPress={() =>
                      setResults((prev) => ({
                        ...prev,
                        [item.id]: 'notTested',
                      }))
                    }
                  />
                  <ResultIcon
                    result="positive"
                    active={currentResult === 'positive'}
                    onPress={() =>
                      setResults((prev) => ({
                        ...prev,
                        [item.id]: 'positive',
                      }))
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

// Style definitions
const styles = StyleSheet.create({
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    padding: 10,
    maxHeight: '100%'
  },
  title: {
    // marginBottom: 10,
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
