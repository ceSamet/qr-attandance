import request from 'supertest';
import express from 'express';
import courseRoutes from '../routes/courses';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

process.env.JWT_SECRET = 'testsecret';

describe('Course Controller', () => {
  jest.setTimeout(30000);
  let app: express.Application;
  let token: string;
  let instructorId: number;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/courses', courseRoutes);
    // Create a test instructor
    const passwordHash = await require('bcryptjs').hash('testpass', 10);
    const user = await prisma.user.create({ data: { name: 'Instructor', email: 'inst@example.com', passwordHash, role: 'instructor' } });
    instructorId = user.id;
    token = jwt.sign({ id: instructorId, role: 'instructor' }, process.env.JWT_SECRET as string);
  });

  afterAll(async () => {
    await prisma.attendance.deleteMany();
    await prisma.session.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();
  });

  it('should create a course', async () => {
    const res = await request(app)
      .post('/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Math 101', instructorId });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Math 101');
    expect(res.body.instructorId).toBe(instructorId);
  });

  it('should list courses', async () => {
    const res = await request(app).get('/courses');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
}); 