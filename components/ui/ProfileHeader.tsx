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
  // Optional callback for submitting test results; if provided, shows the link.
  onSubmitTest?: () => void;
};

export function ProfileHeader({ displayName, imageUrl, onEditName, onEditPhoto, onSubmitTest }: ProfileHeaderProps) {
  const theme = useTheme();
  return (
    <View style={theme.profileHeader}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={theme.profileImage} />
      ) : (
        <DefaultAvatar size={100} />
      )}
      <View style={theme.profileTextContainer}>
        <Text style={theme.profileName}>{displayName}</Text>
        <View style={theme.profileHeaderLinksRow}>
          <TouchableOpacity onPress={onEditName}>
            <Text style={theme.profileHeaderLink}>Edit Name</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onEditPhoto}>
            <Text style={theme.profileHeaderLink}>Edit Photo</Text>
          </TouchableOpacity>
          {onSubmitTest && (
            <TouchableOpacity onPress={onSubmitTest}>
              <Text style={theme.profileHeaderSubmitLink}>Submit Test Result</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}
