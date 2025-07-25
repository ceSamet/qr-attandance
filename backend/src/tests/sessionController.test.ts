import request from 'supertest';
import express from 'express';
import sessionRoutes from '../routes/sessions';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

process.env.JWT_SECRET = 'testsecret';

describe('Session Controller', () => {
  jest.setTimeout(30000);
  let app: express.Application;
  let token: string;
  let courseId: number;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/sessions', sessionRoutes);
    // Create a test instructor and course
    const passwordHash = await require('bcryptjs').hash('testpass', 10);
    const user = await prisma.user.create({ data: { name: 'Instructor', email: 'inst2@example.com', passwordHash, role: 'instructor' } });
    const course = await prisma.course.create({ data: { name: 'Physics', instructorId: user.id } });
    courseId = course.id;
    token = jwt.sign({ id: user.id, role: 'instructor' }, process.env.JWT_SECRET as string);
  });

  afterAll(async () => {
    await prisma.attendance.deleteMany();
    await prisma.session.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();
  });

  it('should create a session', async () => {
    const res = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ courseId, date: new Date(), timeStart: '09:00', timeEnd: '10:00', type: 'entry' });
    expect(res.status).toBe(201);
    expect(res.body.courseId).toBe(courseId);
    expect(res.body.type).toBe('entry');
  });

  it('should list sessions for a course', async () => {
    const res = await request(app).get(`/sessions/${courseId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
}); 