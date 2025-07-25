import { Request, Response } from 'express';
import prisma from '../prisma';

export async function createCourse(req: Request, res: Response) {
  const { name, instructorId } = req.body;
  const course = await prisma.course.create({ data: { name, instructorId: Number(instructorId) } });
  res.status(201).json(course);
}

export async function getCourses(req: Request, res: Response) {
  const courses = await prisma.course.findMany();
  res.json(courses);
} 