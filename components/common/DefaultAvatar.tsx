// components/DefaultAvatar.tsx
import React from 'react';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

interface DefaultAvatarProps {
  size?: number;
}

const DefaultAvatar: React.FC<DefaultAvatarProps> = ({ size = 150 }) => {
  return (
    <Svg height={size} width={size} viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r="45" stroke="#ccc" strokeWidth="2" fill="#eee" />
      <SvgText
        x="50%"
        y="55%"
        fill="#aaa"
        fontSize="20"
        fontWeight="bold"
        textAnchor="middle"
      >
        Avatar
      </SvgText>
    </Svg>
  );
};

export default DefaultAvatar;
