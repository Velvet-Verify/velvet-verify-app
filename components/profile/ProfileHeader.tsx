// components/profile/ProfileHeader.tsx
import React from 'react';
import { View, Text, TouchableOpacity, Image, Button, StyleSheet } from 'react-native';
import { useTheme } from 'styled-components/native';
import Colors from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import DefaultAvatar from '@/components/common/DefaultAvatar';

type ProfileHeaderProps = {
  displayName: string;
  imageUrl?: string;

  // “Edit profile” link
  onEditProfile?: () => void;

  // Optional logout / close icons
  onLogout?: () => void;
  onClose?: () => void;

  // Optionally hide the entire action‑row
  hideEditButtons?: boolean;

  // Extra connection‑view actions
  connectionType?: string;
  connectionStatus?: string;
  showManageButton?: boolean;
  manageLabel?: string;
  onManagePress?: () => void;

  /** ⚠️  onSubmitTest has been deprecated – remove it wherever you render this component. */
  // onSubmitTest?: () => void;
};

export function ProfileHeader({
  displayName,
  imageUrl,
  onEditProfile,
  onLogout,
  onClose,
  hideEditButtons,
  connectionType,
  connectionStatus,
  showManageButton,
  manageLabel,
  onManagePress,
}: ProfileHeaderProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme() ?? 'light';
  const iconColor = Colors[colorScheme].icon;

  return (
    <View style={theme.profileHeader}>
      {/* Close / logout button (top‑right) */}
      {onClose ? (
        <TouchableOpacity style={styles.topRight} onPress={onClose}>
          <Text style={{ color: iconColor, fontSize: 24 }}>✕</Text>
        </TouchableOpacity>
      ) : onLogout ? (
        <View style={styles.topRight}>
          <Button title="Log out" onPress={onLogout} color={theme.buttonPrimary.backgroundColor} />
        </View>
      ) : null}

      {/* Avatar */}
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={theme.profileImage} />
      ) : (
        <DefaultAvatar size={100} />
      )}

      {/* Name & extras */}
      <View style={theme.profileTextContainer}>
        <Text style={theme.profileName}>{displayName}</Text>

        {connectionType && <Text style={theme.bodyText}>{connectionType}</Text>}
        {/* {connectionStatus && <Text style={theme.bodyText}>Status: {connectionStatus}</Text>} */}

        {!hideEditButtons && (
          <View style={theme.profileHeaderActionsRow}>
            {onEditProfile && (
              <TouchableOpacity onPress={onEditProfile}>
                <Text style={theme.profileHeaderLink}>Profile Edit</Text>
              </TouchableOpacity>
            )}

            {/* Submit‑test link completely removed */}

            {/* {showManageButton && onManagePress && (
              <TouchableOpacity onPress={onManagePress}>
                <Text style={theme.profileHeaderLink}>{manageLabel ?? 'Manage'}</Text>
              </TouchableOpacity>
            )} */}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topRight: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 999,
  },
});
