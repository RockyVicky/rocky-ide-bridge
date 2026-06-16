```javascript
// Text.js
import React from 'react';
import { useTheme } from '../theme/ThemeProvider';

const Text = ({ children }) => {
  const theme = useTheme();

  return (
    <p style={{ color: theme.text }}>{children}</p>
  );
};

export default Text;