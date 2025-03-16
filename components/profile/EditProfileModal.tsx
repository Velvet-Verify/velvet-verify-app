// components/ui/EditProfileModal.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Image, 
  TextInput, 
  Button, 
  TouchableOpacity,
  Alert,
  StyleSheet 
} from 'react-native';
import { useTheme } from 'styled-components/native';
import { ThemedModal } from '../ui/ThemedModal';
import DefaultAvatar from '@/components/common/DefaultAvatar';
import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

type EditProfileModalProps = {
  visible: boolean;
  initialDisplayName: string;
  initialPhotoUri?: string;
  onSave: (displayName: string, photoUri: string) => Promise<void>;
  onCancel: () => void;
  // Optional props for customizing the modal
  title?: string;
  showCancel?: boolean;
};

export function EditProfileModal({
  visible,
  initialDisplayName,
  initialPhotoUri,
  onSave,
  onCancel,
  title = "Edit Profile",
  showCancel = true,
}: EditProfileModalProps) {
  const theme = useTheme();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [photoUri, setPhotoUri] = useState(initialPhotoUri || '');

  useEffect(() => {
    setDisplayName(initialDisplayName);
    setPhotoUri(initialPhotoUri || '');
  }, [initialDisplayName, initialPhotoUri]);

  // Function to pick an image from the gallery.
  const pickImageFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Gallery permission is needed!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  // Function to take a photo.
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera permission is needed!');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  // Function to remove the current photo.
  const removePhoto = () => {
    setPhotoUri('');
  };

  // Display an action sheet for photo options.
  const handleEditPhoto = () => {
    Alert.alert(
      'Edit Photo',
      'Select an option',
      [
        { text: 'Gallery', onPress: pickImageFromGallery },
        { text: 'Camera', onPress: takePhoto },
        { text: 'Remove', onPress: removePhoto, style: 'destructive' },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  // Reset local state then call onCancel.
  const handleCancel = () => {
    setDisplayName(initialDisplayName);
    setPhotoUri(initialPhotoUri || '');
    onCancel();
  };

  // Validate display name before saving.
  const handleSave = async () => {
    const trimmedName = displayName.trim();
    if (!/^(?=.*[A-Za-z])[A-Za-z\s'-]+$/.test(trimmedName)) {
      Alert.alert(
        'Invalid Display Name',
        "Display name must contain at least one letter and can only contain letters, spaces, dashes (-), and apostrophes (')."
      );
      return;
    }
    await onSave(trimmedName, photoUri);
  };

  return (
    <ThemedModal visible={visible} onRequestClose={handleCancel}>
      <Text style={theme.modalTitle}>{title}</Text>
      <TextInput
        style={theme.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Enter display name"
      />

      {/* Avatar container with pencil icon overlay */}
      <View style={styles.avatarContainer}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={theme.previewImage} />
        ) : (
          <DefaultAvatar size={150} />
        )}
        <TouchableOpacity onPress={handleEditPhoto} style={styles.editIconContainer}>
          <FontAwesome name="pencil" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Render Cancel button conditionally */}
      <View style={theme.buttonRow}>
        {showCancel && (
          <Button
            title="Cancel"
            onPress={handleCancel}
            color={theme.buttonSecondary.backgroundColor}
          />
        )}
        <Button
          title="Save"
          onPress={handleSave}
          color={theme.buttonPrimary.backgroundColor}
        />
      </View>
    </ThemedModal>
  );
}

const styles = StyleSheet.create({
  avatarContainer: {
    position: 'relative',
    width: 150,
    height: 150,
    alignSelf: 'center',
    marginBottom: 20,
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 5,
    right: 10,
    backgroundColor: 'crimson',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 7.5,
  },
});
