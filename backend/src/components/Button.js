```javascript
// Button.js
import React from 'react';
import { useTheme } from '../theme/ThemeProvider';

const Button = ({ children }) => {
  const theme = useTheme();

  return (
    <button style={{ background: theme.background, color: theme.text }}>
      {children}
    </button>
  );
};

export default Button;