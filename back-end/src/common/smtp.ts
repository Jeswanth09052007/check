import { ServiceUnavailableException } from "@nestjs/common";

export async function mail(
  to: string,
  subject: string,
  text: string,
  attachment?: string,
) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM)
    throw new ServiceUnavailableException(
      "Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM.",
    );
  const nodemailer = require("nodemailer");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_PORT === "465",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  return transport.sendMail({
    from: process.env.SMTP_FROM,
    to: { address: to },
    subject,
    text,
    attachments: attachment
      ? [{ filename: "indai-credentials.csv", content: attachment }]
      : [],
  });
}
