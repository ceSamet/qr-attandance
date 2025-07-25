import { authenticateJWT } from '../middleware/auth';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

describe('authenticateJWT middleware', () => {
  const secret = 'testsecret';
  process.env.JWT_SECRET = secret;

  it('should call next if token is valid', () => {
    const token = jwt.sign({ id: '123', role: 'admin' }, secret);
    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const res: any = {};
    const next = jest.fn();
    authenticateJWT(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe('123');
  });

  it('should return 401 if no token', () => {
    const req: any = { headers: {} };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    authenticateJWT(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'No token provided' });
  });

  it('should return 401 if token is invalid', () => {
    const req: any = { headers: { authorization: 'Bearer invalidtoken' } };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    authenticateJWT(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid token' });
  });
}); 