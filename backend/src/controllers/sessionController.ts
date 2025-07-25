import { Request, Response } from 'express';
import prisma from '../prisma';
import { v4 as uuidv4 } from 'uuid';

export async function createSession(req: Request, res: Response) {
  const { courseId, date, timeStart, timeEnd, type } = req.body;
  const qrToken = uuidv4();
  const session = await prisma.session.create({
    data: {
      courseId: Number(courseId),
      qrToken,
      date: new Date(date),
      timeStart,
      timeEnd,
      type
    }
  });
  res.status(201).json(session);
}

export async function getSessionsByCourse(req: Request, res: Response) {
  const { courseId } = req.params;
  const sessions = await prisma.session.findMany({ where: { courseId: Number(courseId) } });
  res.json(sessions);
} 