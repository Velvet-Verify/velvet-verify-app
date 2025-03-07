// constants/Colors.ts

export const Colors = {
  light: {
    primary: '#800020',         // For headings and accent elements
    text: '#444444',            // Subtle charcoal text
    background: '#ffffff',      // White background
    buttonPrimary: '#DC143C',   // Crimson for primary buttons
    buttonSecondary: '#d3d3d3',  // Light gray for secondary buttons
    tint: '#800020',            // For tinting icons or links (using primary)
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#800020',
  },
  dark: {
    primary: '#800020',         // Retain primary for headings (if contrast is acceptable)
    text: '#ECEDEE',            // Light text for dark mode
    background: '#151718',      // Dark background
    buttonPrimary: '#DC143C',   // Crimson remains for primary buttons
    buttonSecondary: '#888888',  // Darker gray for secondary buttons on dark background
    tint: '#ffffff',            // White tint for icons/links
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#ffffff',
  },
};

export default Colors;
