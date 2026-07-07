import { Request, Response, NextFunction } from "express";

export function auth(req: Request, res: Response, next: NextFunction): void {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    res.status(500).json({ error: "Пароль администратора не настроен" });
    return;
  }

  const provided = req.headers["x-admin-password"];

  if (!provided || provided !== adminPassword) {
    res.status(401).json({ error: "Неверный пароль" });
    return;
  }

  next();
}
