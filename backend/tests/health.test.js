const request = require('supertest');
const { app, server } = require('../src/index');
const db = require('../src/utils/database');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../src/middleware/auth');

// Increase timeout for DB operations
jest.setTimeout(10000);

const token = jwt.sign({ role: 'admin' }, JWT_SECRET);

describe('API Health Checks', () => {
  // Close database and server after all tests
  afterAll(async () => {
    // Check if db has a close method, otherwise we just let it be for now
    // server.close() is important to stop the process
    server.close();
  });

  test('GET /api/status should return online', async () => {
    const response = await request(app).get('/api/status');
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('online');
  });

  test('GET /api/models should return model stats', async () => {
    const response = await request(app)
      .get('/api/models')
      .set('Authorization', `Bearer ${token}`);
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('usageStats');
  });

  test('GET /api/goals should return an array of goals', async () => {
    const response = await request(app)
      .get('/api/goals')
      .set('Authorization', `Bearer ${token}`);
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('goals');
    expect(Array.isArray(response.body.goals)).toBe(true);
  });
});
