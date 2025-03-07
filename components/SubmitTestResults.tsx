// components/SubmitTestResults.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  Alert,
  FlatList,
  TouchableOpacity,
  Platform,
  TextInput,
} from 'react-native';
import DateTimePicker, {
  AndroidNativeProps,
  IOSNativeProps,
} from '@react-native-community/datetimepicker';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useRouter } from 'expo-router';
import { getFirestore, collection, addDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/src/firebase/config';
import { useAuth } from '@/src/context/AuthContext';
import {
  computeHSUUIDFromSUUID,
  computeTSUUIDFromSUUID,
} from '@/src/utils/hash';
import { useStdis } from '@/hooks/useStdis';
import { useTheme } from 'styled-components/native';

type TestResultOption = 'positive' | 'negative' | 'notTested';

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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [results, setResults] = useState<{ [key: string]: TestResultOption }>(
    {}
  );
  const [submitting, setSubmitting] = useState(false);

  // Initialize results to "notTested" for each STDI when stdis load.
  useEffect(() => {
    if (!stdisLoading && stdis.length > 0) {
      const initialResults: { [key: string]: TestResultOption } = {};
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
        // Only process if the result is positive or negative.
        if (resultOption === 'notTested') continue;

        const booleanResult = resultOption === 'positive';
        const tsuuid = await computeTSUUIDFromSUUID(suuid);

        // Add a new document in testResults collection:
        await addDoc(collection(db, 'testResults'), {
          STDI: stdi.id,
          TSUUID: tsuuid,
          result: booleanResult,
          testDate: testDate,
        });

        // Update healthStatus
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
          // If the document exists, update only if new testDate is later
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

  // If we’re still loading STDIs, show a loading screen
  if (stdisLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.title, theme.title]}>Loading STDIs...</Text>
      </View>
    );
  }

  // For iOS, we explicitly set display="spinner" so it shows a single overlay immediately
  // For Android, "default" is fine. (If you prefer the Android spinner style, you can use "spinner" too.)
  const datePickerDisplay: IOSNativeProps['display'] | AndroidNativeProps['display'] =
    Platform.OS === 'ios' ? 'spinner' : 'default';

  return (
    <View style={styles.container}>
      <Text style={[styles.title, theme.title]}>Submit Test Results</Text>

      {/* Show selected date or placeholder */}
      <View style={styles.dateRow}>
        <Text style={styles.label}>
          Test Date: {testDate.toLocaleDateString()}
        </Text>

        {Platform.OS === 'web' ? (
          <TextInput
            style={[
              theme.input,
              { marginTop: 8, marginBottom: 16, width: '100%' },
            ]}
            placeholder="YYYY-MM-DD"
            value={testDate.toISOString().slice(0, 10)} // e.g. "2023-12-31"
            onChangeText={(val) => {
              const [year, month, day] = val.split('-').map(Number);
              if (year && month && day) {
                setTestDate(new Date(year, month - 1, day));
              }
            }}
          />
        ) : (
          <>
            <Button
              title="Select Date"
              onPress={() => setDatePickerVisibility(true)}
              color={theme.buttonSecondary.backgroundColor}
            />
            <DateTimePickerModal
              isVisible={isDatePickerVisible}
              mode="date"
              date={testDate}
              onConfirm={(date) => {
                setTestDate(date);
                setDatePickerVisibility(false);
              }}
              onCancel={() => setDatePickerVisibility(false)}
            />
          </>
        )}
      </View>

      <Text style={styles.subtitle}>Select test result for each STDI:</Text>
      {stdis.length === 0 ? (
        <Text>No STDIs available.</Text>
      ) : (
        <FlatList
          data={stdis}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isNegative = results[item.id] === 'negative';
            const isPositive = results[item.id] === 'positive';
            const isNotTested = results[item.id] === 'notTested';

            return (
              <View style={styles.itemRow}>
                <Text style={styles.itemText}>{item.id}</Text>
                <View style={styles.optionContainer}>
                  {/* Negative */}
                  <TouchableOpacity
                    onPress={() =>
                      setResults((prev) => ({ ...prev, [item.id]: 'negative' }))
                    }
                    style={[
                      styles.optionButton,
                      isNegative ? styles.negativeSelected : styles.unselectedOption,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isNegative ? styles.selectedText : styles.unselectedText,
                      ]}
                    >
                      –
                    </Text>
                  </TouchableOpacity>

                  {/* Not Tested */}
                  <TouchableOpacity
                    onPress={() =>
                      setResults((prev) => ({ ...prev, [item.id]: 'notTested' }))
                    }
                    style={[
                      styles.optionButton,
                      isNotTested ? styles.notTestedSelected : styles.unselectedOption,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isNotTested ? styles.selectedText : styles.unselectedText,
                      ]}
                    >
                      ○
                    </Text>
                  </TouchableOpacity>

                  {/* Positive */}
                  <TouchableOpacity
                    onPress={() =>
                      setResults((prev) => ({ ...prev, [item.id]: 'positive' }))
                    }
                    style={[
                      styles.optionButton,
                      isPositive ? styles.positiveSelected : styles.unselectedOption,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isPositive ? styles.selectedText : styles.unselectedText,
                      ]}
                    >
                      +
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      <View style={styles.buttonRow}>
        <Button
          title="Cancel"
          onPress={onClose}
          color={theme.buttonSecondary.backgroundColor}
        />
        <Button
          title={submitting ? 'Submitting...' : 'Submit'}
          onPress={handleSubmit}
          disabled={submitting}
          color={theme.buttonPrimary.backgroundColor}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    // No flex:1 so it doesn't fill the entire ThemedModal
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    // No flex:1 to prevent squishing inside the ThemedModal
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
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
  optionButton: {
    marginHorizontal: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
  negativeSelected: {
    backgroundColor: 'green',
    borderColor: 'green',
  },
  positiveSelected: {
    backgroundColor: 'red',
    borderColor: 'red',
  },
  notTestedSelected: {
    backgroundColor: 'gray',
    borderColor: 'gray',
  },
  unselectedOption: {
    backgroundColor: 'white',
    borderColor: 'gray',
  },
  optionText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  selectedText: {
    color: 'white',
  },
  unselectedText: {
    color: 'gray',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
});
