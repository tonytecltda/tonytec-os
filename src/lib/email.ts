import "server-only";

/**
 * E-mail transacional via Resend (API HTTP, sem SDK). Opcional: sem
 * RESEND_API_KEY/EMAIL_FROM o sistema segue funcionando sem enviar e-mails.
 */
export function emailConfigurado() {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

export async function enviarEmail(params: {
  para: string[];
  assunto: string;
  html: string;
  anexos?: { nome: string; conteudo: Buffer }[];
}): Promise<boolean> {
  if (!emailConfigurado()) return false;
  const para = [...new Set(params.para.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!para.length) return false;

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: para,
        subject: params.assunto,
        html: params.html,
        attachments: params.anexos?.map((a) => ({
          filename: a.nome,
          content: a.conteudo.toString("base64"),
        })),
      }),
    });
    if (!resp.ok) {
      console.error("[email] Resend", resp.status, await resp.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] falha", e);
    return false;
  }
}

/** Escapa texto para uso em HTML de e-mail. */
export const escaparHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
