import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'hospitaltarapotocoordinacion@gmail.com',
    pass: process.env.SMTP_PASS || 'cetf jwss uxuq prgo',
  },
});

export interface SendAccountRequestEmailParams {
  requestToken: string;
  doctorName: string;
  doctorDni: string;
  tuitionCode: string;
  requestedEmail: string;
  phone?: string;
  baseUrl: string;
}

export async function sendAccountRequestApprovalEmail(params: SendAccountRequestEmailParams) {
  const { requestToken, doctorName, doctorDni, tuitionCode, requestedEmail, phone, baseUrl } = params;

  const effectiveBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_APP_URL || baseUrl;

  const approvalUrl = `${effectiveBaseUrl}/approve-request?token=${requestToken}`;
  const rejectionUrl = `${effectiveBaseUrl}/approve-request?token=${requestToken}&action=reject`;

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
        .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; padding: 24px; text-align: center; }
        .header h2 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
        .header p { margin: 6px 0 0 0; opacity: 0.9; font-size: 13px; }
        .content { padding: 24px; }
        .info-grid { background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px; }
        .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #cbd5e1; }
        .info-row:last-child { border-bottom: none; }
        .label { font-weight: 600; color: #475569; }
        .value { font-weight: 700; color: #0f172a; }
        .badge { background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 12px; }
        .actions { display: flex; gap: 12px; margin-top: 24px; justify-content: center; }
        .btn-approve { background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 2px 4px rgba(22, 163, 74, 0.2); }
        .btn-reject { background-color: #ef4444; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2); }
        .footer { background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h2>🏥 HOSPITAL II-2 TARAPOTO</h2>
          <p>Solicitud de Activación de Cuenta Asistencial (FrontCQ / BackCQ)</p>
        </div>
        <div class="content">
          <p>Estimada Jefatura de Centro Quirúrgico,</p>
          <p>Se ha recibido una nueva solicitud para habilitar el acceso al sistema de un profesional del equipo asistencial:</p>
          
          <div class="info-grid">
            <div class="info-row">
              <span class="label">Nombres y Apellidos:</span>
              <span class="value">${doctorName}</span>
            </div>
            <div class="info-row">
              <span class="label">DNI:</span>
              <span class="value">${doctorDni}</span>
            </div>
            <div class="info-row">
              <span class="label">Código Colegiatura:</span>
              <span class="value badge">${tuitionCode}</span>
            </div>
            <div class="info-row">
              <span class="label">Correo Solicitado:</span>
              <span class="value">${requestedEmail}</span>
            </div>
            ${phone ? `
            <div class="info-row">
              <span class="label">Teléfono Celular:</span>
              <span class="value">${phone}</span>
            </div>
            ` : ''}
          </div>

          <p style="font-size: 13px; color: #475569; margin-top: 16px;">
            Al presionar <strong>Aprobar Acceso</strong>, el sistema asociará automáticamente el rol asistencial a la cuenta, actualizará su correo para recibir notificaciones quirúrgicas y activará su contraseña personal.
          </p>

          <div class="actions">
            <a href="${approvalUrl}" class="btn-approve">✔ Aprobar Acceso (1-Clic)</a>
            <a href="${rejectionUrl}" class="btn-reject">✖ Rechazar Solicitud</a>
          </div>
        </div>
        <div class="footer">
          OGESS Especializada San Martín — Sistema de Gestión Quirúrgica BackCQ / FrontCQ
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const fromAddress = process.env.SMTP_FROM || 'hospitaltarapotocoordinacion@gmail.com';
    const recipient = process.env.SMTP_USER || 'hospitaltarapotocoordinacion@gmail.com';

    await transporter.sendMail({
      from: `"FrontCQ / BackCQ" <${fromAddress}>`,
      to: recipient,
      subject: `🚨 [Solicitud de Cuenta] ${doctorName} (DNI ${doctorDni} - ${tuitionCode})`,
      html,
    });
    return { success: true };
  } catch (error) {
    console.error("Error enviando correo de aprobación:", error);
    return { success: false, error: String(error) };
  }
}
