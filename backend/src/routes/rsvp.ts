import { Router, Request, Response } from "express";
import db from "../db";
import { honeypot } from "../middleware/honeypot";
import { postLimiter } from "../middleware/rateLimit";
import { sendGuestConfirmation, notifyCouple } from "../notifications";

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

interface GuestInput {
  id: number;
  display_name?: string;
  name?: string;
  attending: boolean | null;
  dietary_restrictions?: string;
}

interface RsvpBody {
  contact_email?: string;
  email?: string;
  contact_phone?: string;
  phone?: string;
  message?: string;
  guests: GuestInput[];
  _website?: string;
}

// --- Helpers ---

function getInviteWithGuests(token: string) {
  const invite = db
    .prepare("SELECT * FROM invites WHERE token = ?")
    .get(token) as InviteRow | undefined;

  if (!invite) return null;

  const guests = db
    .prepare("SELECT * FROM invited_guests WHERE invite_id = ?")
    .all(invite.id) as GuestRow[];

  return {
    id: invite.id,
    token: invite.token,
    household_label: invite.household_label,
    contact_email: invite.contact_email,
    email: invite.contact_email,
    contact_phone: invite.contact_phone,
    phone: invite.contact_phone,
    message: invite.message,
    created_at: invite.created_at,
    updated_at: invite.updated_at,
    guests: guests.map((g) => ({
      id: g.id,
      display_name: g.display_name,
      name: g.display_name,
      is_placeholder: g.is_placeholder === 1,
      attending:
        g.attending === null ? null : g.attending === 1,
      dietary_restrictions: g.dietary_restrictions,
    })),
  };
}

// --- Routes ---

/**
 * GET /api/invite/:token
 * Look up an invite by its unique token and return it with nested guests.
 */
router.get("/invite/:token", (req: Request<{ token: string }>, res: Response): void => {
  try {
    const token = req.params.token;
    const invite = getInviteWithGuests(token);

    if (!invite) {
      res.status(404).json({ error: "Приглашение не найдено" });
      return;
    }

    res.json(invite);
  } catch (error) {
    console.error("Ошибка при получении приглашения:", error);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

/**
 * POST /api/invite/:token/rsvp
 * Submit RSVP response for an invite.
 */
router.post(
  "/invite/:token/rsvp",
  postLimiter,
  honeypot,
  (req: Request<{ token: string }>, res: Response): void => {
    try {
      const token = req.params.token;
      const body = req.body as RsvpBody;

      // Validate that guests array exists
      if (!body.guests || !Array.isArray(body.guests)) {
        res.status(400).json({ error: "Необходимо указать список гостей" });
        return;
      }

      const invite = db
        .prepare("SELECT * FROM invites WHERE token = ?")
        .get(token) as InviteRow | undefined;

      if (!invite) {
        res.status(404).json({ error: "Приглашение не найдено" });
        return;
      }

      // Use a transaction for atomicity
      const updateTransaction = db.transaction(() => {
        // Update invite contact info and message
        const emailValue = body.contact_email !== undefined ? body.contact_email : (body.email !== undefined ? body.email : invite.contact_email);
        const phoneValue = body.contact_phone !== undefined ? body.contact_phone : (body.phone !== undefined ? body.phone : invite.contact_phone);

        db.prepare(
          `UPDATE invites
           SET contact_email = ?,
               contact_phone = ?,
               message = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).run(
          emailValue,
          phoneValue,
          body.message !== undefined ? body.message : invite.message,
          invite.id
        );

        // Update each guest
        for (const guest of body.guests) {
          // Verify the guest belongs to this invite
          const existingGuest = db
            .prepare(
              "SELECT * FROM invited_guests WHERE id = ? AND invite_id = ?"
            )
            .get(guest.id, invite.id) as GuestRow | undefined;

          if (!existingGuest) continue;

          const attendingValue =
            guest.attending === null ? null : guest.attending ? 1 : 0;
          const nameValue = guest.display_name || guest.name;

          if (existingGuest.is_placeholder === 1 && nameValue) {
            // Placeholder guests can have their display_name updated
            db.prepare(
              `UPDATE invited_guests
               SET display_name = ?,
                   attending = ?,
                   dietary_restrictions = ?
               WHERE id = ?`
            ).run(
              nameValue,
              attendingValue,
              guest.dietary_restrictions || null,
              guest.id
            );
          } else {
            db.prepare(
              `UPDATE invited_guests
               SET attending = ?,
                   dietary_restrictions = ?
               WHERE id = ?`
            ).run(
              attendingValue,
              guest.dietary_restrictions || null,
              guest.id
            );
          }
        }
      });

      updateTransaction();

      // Return updated data
      const updated = getInviteWithGuests(token);

      // Trigger notifications (fire-and-forget)
      if (updated) {
        const guestSummary = updated.guests
          .map(
            (g) =>
              `${g.display_name}: ${
                g.attending === null
                  ? "Не ответил(а)"
                  : g.attending
                  ? "Придёт"
                  : "Не придёт"
              }${g.dietary_restrictions ? ` (${g.dietary_restrictions})` : ""}`
          )
          .join("\n");

        if (body.contact_email) {
          sendGuestConfirmation(body.contact_email, updated.household_label);
        }

        notifyCouple(updated.household_label, guestSummary);
      }

      res.json(updated);
    } catch (error) {
      console.error("Ошибка при сохранении RSVP:", error);
      res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  }
);

export default router;
