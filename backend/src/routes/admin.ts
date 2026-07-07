import { Router, Request, Response } from "express";
import db from "../db";
import { auth } from "../middleware/auth";

const router = Router();

// --- Types ---

interface InviteRow {
  id: number;
  token: string;
  household_label: string;
  contact_email: string | null;
  contact_phone: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
}

interface GuestRow {
  id: number;
  invite_id: number;
  display_name: string;
  is_placeholder: number;
  attending: number | null;
  dietary_restrictions: string | null;
}

// --- Helpers ---

function getAllInvitesWithGuests(status?: string) {
  let invites: InviteRow[];

  if (status === "responded") {
    // At least one guest has attending set (not null)
    invites = db
      .prepare(
        `SELECT DISTINCT i.* FROM invites i
         JOIN invited_guests g ON g.invite_id = i.id
         WHERE g.attending IS NOT NULL`
      )
      .all() as InviteRow[];
  } else if (status === "pending") {
    // No guest has responded yet
    invites = db
      .prepare(
        `SELECT i.* FROM invites i
         WHERE NOT EXISTS (
           SELECT 1 FROM invited_guests g
           WHERE g.invite_id = i.id AND g.attending IS NOT NULL
         )`
      )
      .all() as InviteRow[];
  } else if (status === "declined") {
    // All guests have responded and none are attending
    invites = db
      .prepare(
        `SELECT i.* FROM invites i
         WHERE EXISTS (
           SELECT 1 FROM invited_guests g
           WHERE g.invite_id = i.id AND g.attending IS NOT NULL
         )
         AND NOT EXISTS (
           SELECT 1 FROM invited_guests g
           WHERE g.invite_id = i.id AND g.attending = 1
         )`
      )
      .all() as InviteRow[];
  } else {
    invites = db.prepare("SELECT * FROM invites").all() as InviteRow[];
  }

  return invites.map((invite) => {
    const guests = db
      .prepare("SELECT * FROM invited_guests WHERE invite_id = ?")
      .all(invite.id) as GuestRow[];

    return {
      ...invite,
      email: invite.contact_email,
      phone: invite.contact_phone,
      guests: guests.map((g) => ({
        id: g.id,
        display_name: g.display_name,
        name: g.display_name,
        is_placeholder: g.is_placeholder === 1,
        attending: g.attending === null ? null : g.attending === 1,
        dietary_restrictions: g.dietary_restrictions,
      })),
    };
  });
}

// --- Routes ---

/**
 * GET /api/admin/invites
 * Return all invites with nested guests. Supports ?status= filter.
 */
router.get("/invites", auth, (req: Request, res: Response): void => {
  try {
    const status = req.query.status as string | undefined;
    const invites = getAllInvitesWithGuests(status);
    res.json(invites);
  } catch (error) {
    console.error("Ошибка при получении списка приглашений:", error);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

/**
 * GET /api/admin/export.csv
 * Stream CSV export of all invites and guests.
 */
router.get("/export.csv", auth, (req: Request, res: Response): void => {
  try {
    const invites = getAllInvitesWithGuests();

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="rsvp-export.csv"'
    );

    // BOM for Excel UTF-8 compatibility
    res.write("\uFEFF");

    // Russian column headers
    res.write(
      "Семья,Гость,Присутствие,Диетические ограничения,Email,Телефон,Сообщение,Обновлено\n"
    );

    for (const invite of invites) {
      for (const guest of invite.guests) {
        const attending =
          guest.attending === null
            ? "Не ответил(а)"
            : guest.attending
            ? "Да"
            : "Нет";

        const row = [
          escapeCsv(invite.household_label),
          escapeCsv(guest.display_name),
          attending,
          escapeCsv(guest.dietary_restrictions || ""),
          escapeCsv(invite.contact_email || ""),
          escapeCsv(invite.contact_phone || ""),
          escapeCsv(invite.message || ""),
          escapeCsv(invite.updated_at || ""),
        ].join(",");

        res.write(row + "\n");
      }
    }

    res.end();
  } catch (error) {
    console.error("Ошибка при экспорте CSV:", error);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

function escapeCsv(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default router;
