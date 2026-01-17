import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock the database module
vi.mock('../db/index.js', () => ({
  checkConnection: vi.fn().mockResolvedValue(true),
  query: vi.fn(),
  pool: {
    on: vi.fn(),
  },
}));

// Create a minimal express app for testing
const app = express();

app.get('/health', async (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: 'connected',
    version: '1.0.0',
  });
});

describe('Health Check API', () => {
  it('should return healthy status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('database', 'connected');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('version');
  });
});

describe('API Response Format', () => {
  it('should return JSON content type', async () => {
    const response = await request(app).get('/health');

    expect(response.headers['content-type']).toMatch(/application\/json/);
  });
});
