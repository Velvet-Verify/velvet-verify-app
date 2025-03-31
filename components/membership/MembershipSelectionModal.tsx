// components/membership/MembershipSelectionModal.tsx
import React, { useState } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { firebaseApp } from '@/src/firebase/config';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from 'styled-components/native';
import { ThemedModal } from '@/components/ui/ThemedModal';
import { ThemedButton } from '@/components/ui/ThemedButton';

interface MembershipSelectionModalProps {
  visible: boolean;
  onClose: () => void;
}

export function MembershipSelectionModal({ visible, onClose }: MembershipSelectionModalProps) {
  const theme = useTheme();
  const { user } = useAuth();

  // Default to "premium"
  const [selection, setSelection] = useState<'free' | 'premium'>('premium');

  const functionsInstance = getFunctions(firebaseApp);
  const computeHashedIdCF = httpsCallable(functionsInstance, 'computeHashedId');
  const db = getFirestore(firebaseApp);

  /**
   * Called if the user taps "Yes" in the premium confirm alert. 
   * Creates a membership doc in Firestore with 
   *   muuid, startDate, endDate, type = 'premium'.
   */
  async function createPremiumMembership() {
    if (!user) throw new Error('No user found for membership');

    // 1) Compute membership UUID
    const muuidResult = await computeHashedIdCF({ hashType: 'membership' });
    const muuid = muuidResult.data.hashedId as string;

    // 2) Build start/end
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1); // e.g. +1 month

    // 3) Create doc in 'memberships'
    await addDoc(collection(db, 'memberships'), {
      muuid,
      userUid: user.uid,
      type: 'premium',      // or 'membershipType' if you prefer
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
  }

  /**
   * The single "Confirm" button inside the modal calls this.
   * We show an Alert with "Yes" | "Cancel" based on the selected tier.
   */
  function handleConfirm() {
    if (selection === 'premium') {
      Alert.alert(
        'Confirm Premium',
        'Your membership will be automatically renewed at $4.99/mo. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes',
            onPress: async () => {
              try {
                await createPremiumMembership();
                onClose();
              } catch (err: any) {
                Alert.alert('Membership Error', err.message);
              }
            },
          },
        ]
      );
    } else {
      // Free
      Alert.alert(
        'Are you sure?',
        "Are you sure you don't want the premium features?",
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes',
            onPress: () => {
              // No membership doc created for Free
              onClose();
            },
          },
        ]
      );
    }
  }

  /**
   * Render the bullet list. If selection === 'free', 
   * we apply strikethrough to all but the first item.
   */
  const benefits = [
    {
      id: 1,
      text: 'Send anonymous exposure alerts on positive test results',
      premiumOnly: false,
    },
    {
      id: 2,
      text: 'Receive anonymous STD-Specific exposure alerts when connections test positive',
      premiumOnly: true,
    },
    {
      id: 3,
      text: 'Unlock elevated connection benefits with specific partners:\n   • Continuous alerts with friends\n   • Shared testing schedules with bonded partners',
      premiumOnly: true,
    },
    {
      id: 4,
      text: 'Discounted benefits for premium, bonded partners',
      premiumOnly: true,
    },
  ];

  return (
    <ThemedModal visible={visible} onRequestClose={onClose} useBlur>
      <View style={{ padding: 20 }}>
        {/* Title */}
        <Text style={[theme.modalTitle, { marginBottom: 16 }]}>
          Choose Your Membership
        </Text>

        {/* Row of 2 buttons: Free / Premium */}
        <View style={styles.buttonRow}>
          <ThemedButton
            title="Free"
            variant={selection === 'free' ? 'primary' : 'secondary'}
            onPress={() => setSelection('free')}
            style={styles.selectButton}
          />
          <ThemedButton
            title="Premium"
            variant={selection === 'premium' ? 'primary' : 'secondary'}
            onPress={() => setSelection('premium')}
            style={styles.selectButton}
          />
        </View>

        {/* Bullet List */}
        <View style={{ marginTop: 20 }}>
          {benefits.map((item) => {
            const isStruck = item.premiumOnly && selection === 'free';
            // For the text style, we combine your theme plus local styles
            const textStyle = [
              theme.bodyText,
              styles.bulletText,
              isStruck && styles.struck,
            ];
            return (
              <View key={item.id} style={{ flexDirection: 'row', marginBottom: 8 }}>
                <Text style={textStyle}>• {item.text}</Text>
              </View>
            );
          })}
        </View>

        {/* Single confirm button */}
        <View style={[{ marginTop: 24 }]}>
          <ThemedButton title="Confirm" variant="primary" onPress={handleConfirm} />
        </View>
      </View>
    </ThemedModal>
  );
}

const styles = StyleSheet.create({
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  selectButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  bulletText: {
    fontSize: 16,
  },
  struck: {
    color: '#777',
    fontStyle: 'italic',
    textDecorationLine: 'line-through',
  },
});
