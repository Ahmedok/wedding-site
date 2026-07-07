import { Resend } from "resend";

const apiKey = process.env.EMAIL_API_KEY;
const coupleEmail = process.env.COUPLE_NOTIFICATION_EMAIL;

let resend: Resend | null = null;

if (apiKey) {
  resend = new Resend(apiKey);
  console.log("Email-уведомления включены");
} else {
  console.log("Email-уведомления отключены (EMAIL_API_KEY не задан)");
}

export async function sendGuestConfirmation(
  email: string,
  householdLabel: string
): Promise<void> {
  if (!resend) return;

  try {
    await resend.emails.send({
      from: "Свадьба <noreply@wedding.example.com>",
      to: email,
      subject: "Подтверждение RSVP",
      html: `
        <h2>Спасибо за ваш ответ!</h2>
        <p>Мы получили RSVP от семьи <strong>${householdLabel}</strong>.</p>
        <p>Если вы хотите изменить свой ответ, вернитесь на сайт и заполните форму повторно.</p>
        <p>С нетерпением ждём встречи!</p>
      `,
    });
  } catch (error) {
    console.error("Ошибка отправки подтверждения гостю:", error);
  }
}

export async function notifyCouple(
  householdLabel: string,
  guestSummary: string
): Promise<void> {
  if (!resend || !coupleEmail) return;

  try {
    await resend.emails.send({
      from: "Свадьба RSVP <noreply@wedding.example.com>",
      to: coupleEmail,
      subject: `Новый RSVP: ${householdLabel}`,
      html: `
        <h2>Новый ответ на приглашение</h2>
        <p><strong>Семья:</strong> ${householdLabel}</p>
        <h3>Гости:</h3>
        <pre>${guestSummary}</pre>
      `,
    });
  } catch (error) {
    console.error("Ошибка отправки уведомления паре:", error);
  }
}
