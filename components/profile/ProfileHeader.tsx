// components/ui/ProfileHeader.tsx
import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useTheme } from 'styled-components/native';
import DefaultAvatar from '@/components/common/DefaultAvatar';

type ProfileHeaderProps = {
  displayName: string;
  imageUrl?: string;
  onEditProfile: () => void;
  onSubmitTest?: () => void;
};

export function ProfileHeader({ displayName, imageUrl, onEditProfile, onSubmitTest }: ProfileHeaderProps) {
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
        <View style={theme.profileHeaderActionsRow}>
          <TouchableOpacity onPress={onEditProfile}>
            <Text style={theme.profileHeaderLink}>Edit Profile</Text>
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
