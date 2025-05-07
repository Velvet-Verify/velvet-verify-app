//styled.d.ts
import 'styled-components/native';

declare module 'styled-components' {
  export interface DefaultTheme {
    /** Layout */
    centerContainer: object;
    title:          { color: string };
    input:          object;
    bodyText: object;
    buttonRow: object;
    modalTitle: object;
    previewImage: object;

    /** Buttons */
    buttonPrimary:   { backgroundColor: string };
    buttonSecondary: { backgroundColor: string };
  }
}