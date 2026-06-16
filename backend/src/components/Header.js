```javascript
// Header.js
import React from 'react';
import { useTheme } from '../theme/ThemeProvider';

const Header = ({ children }) => {
  const theme = useTheme();

  return (
    <header style={{ background: theme.background, color: theme.text }}>
      {children}
    </header>
  );
};

export default Header;