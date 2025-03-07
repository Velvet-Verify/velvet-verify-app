// constants/Themes.ts
import { StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';

const typography = {
  fontFamily: 'Montserrat',
  titleFontWeight: '400' as const, // or 'bold'
};

export const lightTheme = StyleSheet.create({
  // Basic container
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    padding: 20,
  },
  // A container that also centers content
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: Colors.light.background,
  },

  // Titles
  title: {
    fontSize: 24,
    fontFamily: typography.fontFamily,
    fontWeight: typography.titleFontWeight,
    color: Colors.light.primary,
    textAlign: 'center',
    marginBottom: 20,
  },

  // Body text (if needed)
  bodyText: {
    fontSize: 16,
    fontFamily: typography.fontFamily,
    color: Colors.light.text,
  },

  // Inputs
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },

  // Buttons
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

  // Common modal styles
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
});

export default { light: lightTheme, dark: darkTheme };
