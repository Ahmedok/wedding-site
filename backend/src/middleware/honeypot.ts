import { Request, Response, NextFunction } from "express";

export function honeypot(req: Request, res: Response, next: NextFunction): void {
  const honeypotValue = req.body?._website;

  // If the honeypot field is filled in, it's likely a bot
  if (typeof honeypotValue === "string" && honeypotValue.length > 0) {
    res.status(400).json({ error: "Неверный запрос" });
    return;
  }

  next();
}
