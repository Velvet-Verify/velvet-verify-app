// constants/Themes.ts
import { StyleSheet } from 'react-native';
import Colors from './Colors';

// Define common typography settings.
const typography = {
  fontFamily: 'Montserrat',
  titleFontSize: 24,
  bodyFontSize: 16,
  // titleFontWeight: 'bold' as 'bold', 
  titleFontWeight: 400, 
};

export const lightTheme = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    padding: 20,
  },
  title: {
    fontSize: typography.titleFontSize,
    fontFamily: typography.fontFamily,
    fontWeight: typography.titleFontWeight,
    color: Colors.light.primary,
  },
  bodyText: {
    fontSize: typography.bodyFontSize,
    fontFamily: typography.fontFamily,
    color: Colors.light.text,
  },
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
  // ... add any additional common styles for light mode.
});

export const darkTheme = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    padding: 20,
  },
  title: {
    fontSize: typography.titleFontSize,
    fontFamily: typography.fontFamily,
    fontWeight: typography.titleFontWeight,
    color: Colors.dark.primary,
  },
  bodyText: {
    fontSize: typography.bodyFontSize,
    fontFamily: typography.fontFamily,
    color: Colors.dark.text,
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
  // ... add any additional common styles for dark mode.
});

export default { light: lightTheme, dark: darkTheme };
