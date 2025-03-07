// components/SubmitTestResults.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Button, 
  StyleSheet, 
  Alert, 
  FlatList, 
  TouchableOpacity 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { getFirestore, collection, addDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/src/firebase/config';
import { useAuth } from '@/src/context/AuthContext';
import { computeHSUUIDFromSUUID, computeTSUUIDFromSUUID } from '@/src/utils/hash';
import { useStdis } from '@/hooks/useStdis';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type TestResultOption = 'positive' | 'negative' | 'notTested';

type SubmitTestResultsProps = {
  onClose: () => void;
};

export default function SubmitTestResults({ onClose }: SubmitTestResultsProps) {
  const { user, suuid } = useAuth();
  const router = useRouter();
  const db = getFirestore(firebaseApp);
  const { stdis, loading: stdisLoading } = useStdis();
  const insets = useSafeAreaInsets();
  
  const [testDate, setTestDate] = useState(new Date());
  const [results, setResults] = useState<{ [key: string]: TestResultOption }>({});
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
        // Compute TSUUID for testResults:
        const tsuuid = await computeTSUUIDFromSUUID(suuid);
        // Add a new document in testResults collection:
        await addDoc(collection(db, 'testResults'), {
          STDI: stdi.id, // storing shortname
          TSUUID: tsuuid,
          result: booleanResult,
          testDate: testDate,
        });
        // Now update healthStatus for this STDI:
        const hsUUID = await computeHSUUIDFromSUUID(suuid);
        // Construct composite ID, e.g., "hsUUID_stdiID"
        const hsDocId = `${hsUUID}_${stdi.id}`;
        const hsDocRef = doc(db, 'healthStatus', hsDocId);
        const hsDocSnap = await getDoc(hsDocRef);
        if (!hsDocSnap.exists()) {
          // Create a new document
          await setDoc(hsDocRef, {
            testResult: booleanResult,
            testDate: testDate,
          });
        } else {
          // If the document exists, update only if new testDate is later.
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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text>Loading STDIs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.title}>Submit Test Results</Text>
        <Text style={styles.label}>Test Date:</Text>
        <DateTimePicker
          value={testDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            if (selectedDate) setTestDate(selectedDate);
          }}
        />
        <Text style={styles.subtitle}>Select test result for each STDI:</Text>
        <FlatList
          data={stdis}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.itemRow}>
              <Text style={styles.itemText}>{item.id}</Text>
              <View style={styles.optionContainer}>
                <TouchableOpacity
                  onPress={() =>
                    setResults((prev) => ({ ...prev, [item.id]: 'positive' }))
                  }
                  style={[
                    styles.optionButton,
                    results[item.id] === 'positive'
                      ? styles.selectedOption
                      : styles.unselectedOption,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      results[item.id] === 'positive'
                        ? styles.selectedText
                        : styles.unselectedText,
                    ]}
                  >
                    +
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    setResults((prev) => ({ ...prev, [item.id]: 'notTested' }))
                  }
                  style={[
                    styles.optionButton,
                    results[item.id] === 'notTested'
                      ? styles.selectedOption
                      : styles.unselectedOption,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      results[item.id] === 'notTested'
                        ? styles.selectedText
                        : styles.unselectedText,
                    ]}
                  >
                    ○
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    setResults((prev) => ({ ...prev, [item.id]: 'negative' }))
                  }
                  style={[
                    styles.optionButton,
                    results[item.id] === 'negative'
                      ? styles.selectedOption
                      : styles.unselectedOption,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      results[item.id] === 'negative'
                        ? styles.selectedText
                        : styles.unselectedText,
                    ]}
                  >
                    –
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
        <View style={styles.buttonRow}>
          <Button title="Cancel" onPress={onClose} />
          <Button title={submitting ? 'Submitting...' : 'Submit'} onPress={handleSubmit} disabled={submitting} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
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
  selectedOption: {
    backgroundColor: 'blue',
    borderColor: 'blue',
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
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
});