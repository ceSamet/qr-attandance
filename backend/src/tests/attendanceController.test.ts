import request from 'supertest';
import express from 'express';
import attendanceRoutes from '../routes/attendances';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

process.env.JWT_SECRET = 'testsecret';

describe('Attendance Controller', () => {
  jest.setTimeout(30000);
  let app: express.Application;
  let sessionId: number;
  let token: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/', attendanceRoutes);
    // Create a test session
    const passwordHash = await require('bcryptjs').hash('testpass', 10);
    const user = await prisma.user.create({ data: { name: 'Instructor', email: 'inst3@example.com', passwordHash, role: 'instructor' } });
    const course = await prisma.course.create({ data: { name: 'Chemistry', instructorId: user.id } });
    const session = await prisma.session.create({ data: { courseId: course.id, qrToken: 'token123', date: new Date(), timeStart: '10:00', timeEnd: '11:00', type: 'entry' } });
    sessionId = session.id;
    token = jwt.sign({ id: user.id, role: 'instructor' }, process.env.JWT_SECRET as string);
  });

  afterAll(async () => {
    await prisma.attendance.deleteMany();
    await prisma.session.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();
  });

  it('should submit attendance', async () => {
    const res = await request(app)
      .post('/attend')
      .send({ token: 'token123', name: 'Ali', surname: 'Veli', ip: '127.0.0.1' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Ali');
    expect(res.body.surname).toBe('Veli');
  });

  it('should list attendances for a session', async () => {
    const res = await request(app)
      .get(`/sessions/${sessionId}/attendances`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
}); 