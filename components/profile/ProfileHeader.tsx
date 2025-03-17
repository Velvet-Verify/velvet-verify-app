// components/profile/ProfileHeader.tsx
import React from 'react';
import { View, Text, TouchableOpacity, Image, Button, StyleSheet } from 'react-native';
import { useTheme } from 'styled-components/native';
import DefaultAvatar from '@/components/common/DefaultAvatar';
import Colors from '@/constants/Colors';
import { useColorScheme } from 'react-native';

type ProfileHeaderProps = {
  displayName: string;
  imageUrl?: string;

  /** If user can edit their own profile, we show 'Edit Profile' link. */
  onEditProfile?: () => void;
  /** If user can submit test results, we show 'Submit Test' link. */
  onSubmitTest?: () => void;
  /** Optionally show a logout button in top-right. */
  onLogout?: () => void;

  /**
   * If true, we hide the usual "edit" / "submit" row entirely,
   * for cases like a public/connection view.
   */
  hideEditButtons?: boolean;

  /**
   * If provided, replaces the top-right area with an 'X' icon
   * that triggers onClose when tapped. 
   */
  onClose?: () => void;

  /**
   * If we want to display a second line under the display name, e.g.:
   * Connection Type: ...
   * Status: ...
   */
  connectionType?: string;
  connectionStatus?: string;
};

/**
 * A flexible user profile header that can show:
 * - Avatar + display name
 * - Optional row with "Edit" / "Submit test"
 * - Optionally a top-right logout or an X icon
 * - Optionally a "Connection Type" and "Status" below name
 */
export function ProfileHeader({
  displayName,
  imageUrl,
  onEditProfile,
  onSubmitTest,
  onLogout,
  hideEditButtons,
  onClose,
  connectionType,
  connectionStatus,
}: ProfileHeaderProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme() ?? 'light';
  const xIconColor = Colors[colorScheme].icon;

  return (
    <View style={theme.profileHeader}>
      {/* If onClose is provided, we show the X in top-right. 
          If onLogout is provided (and onClose is not), we show the logout button. */}
      {onClose ? (
        <TouchableOpacity style={styles.closeIcon} onPress={onClose}>
          <Text style={{ color: xIconColor, fontSize: 24 }}>X</Text>
        </TouchableOpacity>
      ) : onLogout ? (
        <View style={styles.logoutButton}>
          <Button title="Logout" onPress={onLogout} color={theme.buttonPrimary.backgroundColor} />
        </View>
      ) : null}

      {/* Avatar on the left, text on the right */}
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={theme.profileImage} />
      ) : (
        <DefaultAvatar size={100} />
      )}

      <View style={theme.profileTextContainer}>
        {/* Display Name */}
        <Text style={theme.profileName}>{displayName}</Text>

        {/* If connectionType or status is provided, show them beneath name */}
        {connectionType && (
          <Text style={theme.bodyText}>{`Connection Type: ${connectionType}`}</Text>
        )}
        {connectionStatus && (
          <Text style={theme.bodyText}>{`Status: ${connectionStatus}`}</Text>
        )}

        {/* If not hidden and we have either onEditProfile or onSubmitTest, show them in a row */}
        {!hideEditButtons && (onEditProfile || onSubmitTest) && (
          <View style={theme.profileHeaderActionsRow}>
            {onEditProfile && (
              <TouchableOpacity onPress={onEditProfile}>
                <Text style={theme.profileHeaderLink}>Edit Profile</Text>
              </TouchableOpacity>
            )}
            {onSubmitTest && (
              <TouchableOpacity onPress={onSubmitTest}>
                <Text style={theme.profileHeaderSubmitLink}>Submit Test Result</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  closeIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 999,
  },
  logoutButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 999,
  },
});
