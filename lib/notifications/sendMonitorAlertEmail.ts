interface MonitorAlertItem {
  watchlistQuery: string;
  newTextHits: number;
  newVisualHits: number;
  checkedAt: string;
}

interface SendMonitorAlertEmailInput {
  to: string;
  firstName?: string | null;
  items: MonitorAlertItem[];
}

function buildEmailContent(
  firstName: string | null | undefined,
  items: MonitorAlertItem[],
) {
  const greetingName = firstName?.trim() || "there";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const rows = items
    .map((item) => {
      const checkedAt = new Date(item.checkedAt).toLocaleString();

      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;">${item.watchlistQuery}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;">${item.newTextHits}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;">${item.newVisualHits}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;">${checkedAt}</td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#111;">
      <h2 style="margin:0 0 8px;">New Brand Monitor Alerts</h2>
      <p style="margin:0 0 16px;">Hi ${greetingName}, your daily monitor check found new trademark matches.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f7f7f7;">
            <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #ddd;">Monitor</th>
            <th style="padding:10px 12px;text-align:center;border-bottom:1px solid #ddd;">New Text Alerts</th>
            <th style="padding:10px 12px;text-align:center;border-bottom:1px solid #ddd;">New Visual Alerts</th>
            <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #ddd;">Checked At</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:20px 0 0;">
        <a href="${appUrl}/monitor" style="display:inline-block;padding:10px 14px;background:#991b1b;color:#fff;text-decoration:none;border-radius:6px;">
          Open Brand Monitor
        </a>
      </p>
    </div>
  `;

  const subject =
    items.length === 1
      ? `New monitor alerts for "${items[0].watchlistQuery}"`
      : `New monitor alerts across ${items.length} watchlists`;

  return { subject, html };
}

export async function sendMonitorAlertEmail(input: SendMonitorAlertEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "Shefle <alerts@shefle.com>";

  if (!apiKey) {
    console.warn(
      "[Monitor Alerts] RESEND_API_KEY is not set. Skipping email send.",
    );

    return { sent: false, reason: "missing_resend_api_key" as const };
  }

  const { subject, html } = buildEmailContent(input.firstName, input.items);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(`Resend failed (${response.status}): ${body}`);
  }

  return { sent: true as const };
}
