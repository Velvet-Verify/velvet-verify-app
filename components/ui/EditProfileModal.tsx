// components/ui/EditProfileModal.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Image, TextInput, Button } from 'react-native';
import { useTheme } from 'styled-components/native';
import { ThemedModal } from './ThemedModal';
import DefaultAvatar from '@/components/DefaultAvatar';

type EditProfileModalProps = {
  visible: boolean;
  initialDisplayName: string;
  initialPhotoUri?: string;
  onSave: (displayName: string, photoUri: string) => Promise<void>;
  onCancel: () => void;
  onPickImage: () => void;
  onTakePhoto: () => void;
  onRemovePhoto: () => void;
};

export function EditProfileModal({
  visible,
  initialDisplayName,
  initialPhotoUri,
  onSave,
  onCancel,
  onPickImage,
  onTakePhoto,
  onRemovePhoto,
}: EditProfileModalProps) {
  const theme = useTheme();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [photoUri, setPhotoUri] = useState(initialPhotoUri || '');

  // Optionally update local state when initial props change.
  useEffect(() => {
    setDisplayName(initialDisplayName);
    setPhotoUri(initialPhotoUri || '');
  }, [initialDisplayName, initialPhotoUri]);

  return (
    <ThemedModal visible={visible} onRequestClose={onCancel}>
      <Text style={theme.modalTitle}>Edit Profile</Text>
      <TextInput
        style={theme.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Enter display name"
      />
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={theme.previewImage} />
      ) : (
        <DefaultAvatar size={150} />
      )}
      <View style={theme.buttonRow}>
        <Button title="Gallery" onPress={onPickImage} color={theme.buttonPrimary.backgroundColor} />
        <Button title="Camera" onPress={onTakePhoto} color={theme.buttonPrimary.backgroundColor} />
        <Button title="Remove" onPress={onRemovePhoto} color={theme.buttonPrimary.backgroundColor} />
      </View>
      <View style={theme.buttonRow}>
        <Button title="Cancel" onPress={onCancel} color={theme.buttonSecondary.backgroundColor} />
        <Button title="Save" onPress={() => onSave(displayName, photoUri)} color={theme.buttonPrimary.backgroundColor} />
      </View>
    </ThemedModal>
  );
}
