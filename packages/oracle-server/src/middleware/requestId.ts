import type { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

export function requestId(req: Request, _res: Response, next: NextFunction): void {
  (req as any).requestId = uuidv4();
  next();
}
