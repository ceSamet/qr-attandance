import { Request, Response } from 'express';
import prisma from '../prisma';

export async function submitAttendance(req: Request, res: Response) {
  const { token, name, surname, ip } = req.body;
  const session = await prisma.session.findUnique({ where: { qrToken: token } });
  if (!session) {
    console.log('Session not found for token:', token);
    const allSessions = await prisma.session.findMany();
    console.log('All sessions in DB:', allSessions);
    return res.status(404).json({ message: 'Session not found' });
  }
  const attendance = await prisma.attendance.create({
    data: {
      sessionId: session.id,
      name,
      surname,
      ip
    }
  });
  res.status(201).json(attendance);
}

export async function getAttendancesBySession(req: Request, res: Response) {
  const { id } = req.params;
  const attendances = await prisma.attendance.findMany({ where: { sessionId: Number(id) } });
  res.json(attendances);
} 