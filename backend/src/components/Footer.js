```javascript
// Footer.js
import React from 'react';
import { useTheme } from '../theme/ThemeProvider';

const Footer = ({ children }) => {
  const theme = useTheme();

  return (
    <footer style={{ background: theme.background, color: theme.text }}>
      {children}
    </footer>
  );
};

export default Footer;