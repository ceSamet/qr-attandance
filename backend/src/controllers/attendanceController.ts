import { Request, Response } from 'express';
import Attendance from '../models/Attendance';
import Session from '../models/Session';

export async function submitAttendance(req: Request, res: Response) {
  const { token, name, surname, ip } = req.body;
  const session = await Session.findOne({ qrToken: token });
  if (!session) return res.status(404).json({ message: 'Session not found' });
  const attendance = new Attendance({ sessionId: session._id, name, surname, ip });
  await attendance.save();
  res.status(201).json(attendance);
}

export async function getAttendancesBySession(req: Request, res: Response) {
  const { id } = req.params;
  const attendances = await Attendance.find({ sessionId: id });
  res.json(attendances);
} 