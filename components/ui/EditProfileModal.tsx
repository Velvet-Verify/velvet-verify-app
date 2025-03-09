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
import { ThemedModal } from './ThemedModal';
import DefaultAvatar from '@/components/DefaultAvatar';
import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

type EditProfileModalProps = {
  visible: boolean;
  initialDisplayName: string;
  initialPhotoUri?: string;
  // onSave should handle updating Firebase storage and the database.
  onSave: (displayName: string, photoUri: string) => Promise<void>;
  onCancel: () => void;
};

export function EditProfileModal({
  visible,
  initialDisplayName,
  initialPhotoUri,
  onSave,
  onCancel,
}: EditProfileModalProps) {
  const theme = useTheme();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [photoUri, setPhotoUri] = useState(initialPhotoUri || '');

  // Update local state if props change.
  useEffect(() => {
    setDisplayName(initialDisplayName);
    setPhotoUri(initialPhotoUri || '');
  }, [initialDisplayName, initialPhotoUri]);

  // Adapted function from index.tsx for picking an image from the gallery.
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

  // Adapted function from index.tsx for taking a photo.
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

  // Function to remove the photo.
  const removePhoto = () => {
    setPhotoUri('');
  };

  // Show an action sheet for photo options.
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

  // Reset local state and then call onCancel.
  const handleCancel = () => {
    setDisplayName(initialDisplayName);
    setPhotoUri(initialPhotoUri || '');
    onCancel();
  };

  return (
    <ThemedModal visible={visible} onRequestClose={handleCancel}>
      <Text style={theme.modalTitle}>Edit Profile</Text>
      <TextInput
        style={theme.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Enter display name"
      />

      {/* Avatar container with edit (pencil) icon overlay */}
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

      {/* Cancel/Save buttons */}
      <View style={theme.buttonRow}>
        <Button
          title="Cancel"
          onPress={handleCancel}
          color={theme.buttonSecondary.backgroundColor}
        />
        <Button
          title="Save"
          onPress={() => onSave(displayName, photoUri)}
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
