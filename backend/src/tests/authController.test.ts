import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';

process.env.JWT_SECRET = 'testsecret';

describe('Auth Controller', () => {
  jest.setTimeout(30000);
  let app: express.Application;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
    // Create a test user
    const passwordHash = await bcrypt.hash('testpass', 10);
    await prisma.user.create({ data: { name: 'Test', email: 'test@example.com', passwordHash, role: 'instructor' } });
  });

  afterAll(async () => {
    await prisma.attendance.deleteMany();
    await prisma.session.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();
  });

  it('should login with correct credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'testpass' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
  });

  it('should fail with wrong credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });
}); 