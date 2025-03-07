// constants/Themes.ts
import { StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';

const typography = {
  fontFamily: 'Montserrat',
  titleFontWeight: '400' as const, // or 'bold'
};

export const lightTheme = StyleSheet.create({
  // Basic containers
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: Colors.light.background,
  },

  // Text styles
  title: {
    fontSize: 24,
    fontFamily: typography.fontFamily,
    fontWeight: typography.titleFontWeight,
    color: Colors.light.primary,
    textAlign: 'center',
    marginBottom: 20,
  },
  bodyText: {
    fontSize: 16,
    fontFamily: typography.fontFamily,
    color: Colors.light.text,
  },

  // Input field
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },

  // Button styles
  buttonPrimary: {
    backgroundColor: Colors.light.buttonPrimary,
    padding: 10,
    borderRadius: 5,
  },
  buttonSecondary: {
    backgroundColor: Colors.light.buttonSecondary,
    padding: 10,
    borderRadius: 5,
  },

  // Layout helpers
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },

  // Preview (used in ProfileSetup, etc.)
  previewImage: {
    width: 150,
    height: 150,
    alignSelf: 'center',
    marginBottom: 20,
    borderRadius: 75,
  },
  previewText: {
    textAlign: 'center',
    marginBottom: 20,
    color: '#888',
  },

  // Modal styles
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: Colors.light.text,
  },

  // Profile Header Styles
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profileTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  profileName: {
    fontSize: 24,
    fontFamily: typography.fontFamily,
    fontWeight: typography.titleFontWeight,
    color: Colors.light.primary,
  },
  // New: container for the bottom row of links
  profileHeaderActionsRow: {
    flexDirection: 'row',
    marginTop: 5,
  },
  // For individual link styles:
  profileHeaderLink: {
    fontSize: 14,
    color: Colors.light.buttonSecondary,
    marginRight: 10,
  },
  profileHeaderSubmitLink: {
    fontSize: 14,
    color: Colors.light.buttonPrimary, // red-ish tone for submit
  },

  // Health status area
  healthStatusContainer: {
    width: '100%',
    marginVertical: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
  },
  healthStatusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: Colors.light.primary,
  },
});

export const darkTheme = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: Colors.dark.background,
  },
  title: {
    fontSize: 24,
    fontFamily: typography.fontFamily,
    fontWeight: typography.titleFontWeight,
    color: Colors.dark.primary,
    textAlign: 'center',
    marginBottom: 20,
  },
  bodyText: {
    fontSize: 16,
    fontFamily: typography.fontFamily,
    color: Colors.dark.text,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  buttonPrimary: {
    backgroundColor: Colors.dark.buttonPrimary,
    padding: 10,
    borderRadius: 5,
  },
  buttonSecondary: {
    backgroundColor: Colors.dark.buttonSecondary,
    padding: 10,
    borderRadius: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  previewImage: {
    width: 150,
    height: 150,
    alignSelf: 'center',
    marginBottom: 20,
    borderRadius: 75,
  },
  previewText: {
    textAlign: 'center',
    marginBottom: 20,
    color: '#888',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: '#222',
    padding: 20,
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: Colors.dark.text,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profileTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  profileName: {
    fontSize: 24,
    fontFamily: typography.fontFamily,
    fontWeight: typography.titleFontWeight,
    color: Colors.dark.primary,
  },
  profileHeaderActionsRow: {
    flexDirection: 'row',
    marginTop: 5,
  },
  profileHeaderLink: {
    fontSize: 14,
    color: Colors.dark.buttonSecondary,
    marginRight: 10,
  },
  profileHeaderSubmitLink: {
    fontSize: 14,
    color: Colors.dark.buttonPrimary,
  },
  healthStatusContainer: {
    width: '100%',
    marginVertical: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 8,
  },
  healthStatusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: Colors.dark.primary,
  },
});

export default { light: lightTheme, dark: darkTheme };
