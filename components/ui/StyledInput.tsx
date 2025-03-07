// components/ui/StyledInput.tsx
import styled from 'styled-components/native';

export const StyledInput = styled.TextInput`
  border-width: 1px;
  border-color: ${({ theme }) => theme.input.borderColor};
  padding: 10px;
  border-radius: 5px;
  margin-bottom: 10px;
`;
