const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'rocky-internal-testing-secret-2026';

const authenticateToken = (req, res, next) => {
    // Skip auth for health checks or status if desired, 
    // but for internal testing level, we protect everything.
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: Missing Token' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Forbidden: Invalid Token' });
        }
        req.user = user;
        next();
    });
};

module.exports = { authenticateToken, JWT_SECRET };
