// components/common/HapticTab.tsx
import { Pressable, View } from 'react-native';
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';

export function HapticTab({ onPress, ...rest }: BottomTabBarButtonProps) {
  return (
    <Pressable
      onPress={evt => {
        Haptics.selectionAsync();
        onPress?.(evt);
      }}
      android_ripple={{ color: '#0000001a', borderless: true }}
      {...rest}
    />
  );
}
