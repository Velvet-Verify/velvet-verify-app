// components/ui/ProfileHeader.tsx
import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useTheme } from 'styled-components/native';
import DefaultAvatar from '@/components/DefaultAvatar';

type ProfileHeaderProps = {
  displayName: string;
  imageUrl?: string;
  onEditName: () => void;
  onEditPhoto: () => void;
};

export function ProfileHeader({ displayName, imageUrl, onEditName, onEditPhoto }: ProfileHeaderProps) {
  const theme = useTheme();
  return (
    <View style={theme.profileHeader}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={theme.profileImage} />
      ) : (
        <DefaultAvatar size={100} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={theme.profileName}>{displayName}</Text>
      </View>
      <TouchableOpacity onPress={onEditName} style={{ marginRight: 10 }}>
        <Text style={theme.editButtonText}>Edit Name</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onEditPhoto}>
        <Text style={theme.editButtonText}>Edit Photo</Text>
      </TouchableOpacity>
    </View>
  );
}
