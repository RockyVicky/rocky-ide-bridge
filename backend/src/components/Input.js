```javascript
// Input.js
import React from 'react';
import { useTheme } from '../theme/ThemeProvider';

const Input = ({ children }) => {
  const theme = useTheme();

  return (
    <input style={{ background: theme.background, color: theme.text }} />
  );
};

export default Input;