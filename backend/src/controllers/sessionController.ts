import { Request, Response } from 'express';
import Session from '../models/Session';
import { v4 as uuidv4 } from 'uuid';

export async function createSession(req: Request, res: Response) {
  const { courseId, date, timeStart, timeEnd, type } = req.body;
  const qrToken = uuidv4();
  const session = new Session({ courseId, qrToken, date, timeStart, timeEnd, type });
  await session.save();
  res.status(201).json(session);
}

export async function getSessionsByCourse(req: Request, res: Response) {
  const { courseId } = req.params;
  const sessions = await Session.find({ courseId });
  res.json(sessions);
} 