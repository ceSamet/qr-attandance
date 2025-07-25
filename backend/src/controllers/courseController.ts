import { Request, Response } from 'express';
import Course from '../models/Course';

export async function createCourse(req: Request, res: Response) {
  const { name, instructorId } = req.body;
  const course = new Course({ name, instructorId });
  await course.save();
  res.status(201).json(course);
}

export async function getCourses(req: Request, res: Response) {
  const courses = await Course.find();
  res.json(courses);
} 