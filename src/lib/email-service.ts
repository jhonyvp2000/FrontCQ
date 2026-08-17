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

  // Dual URL Construction: External (Public Internet 177.67.250.138:8087) vs Internal (Hospital LAN 192.168.41.25:3008)
  const externalBaseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://177.67.250.138:8087').replace(/\/$/, '');
  const internalBaseUrl = (process.env.INTERNAL_SITE_URL || baseUrl || 'http://192.168.41.25:3008').replace(/\/$/, '');

  const externalApprovalUrl = `${externalBaseUrl}/approve-request?token=${requestToken}`;
  const internalApprovalUrl = `${internalBaseUrl}/approve-request?token=${requestToken}`;

  const externalRejectionUrl = `${externalBaseUrl}/approve-request?token=${requestToken}&action=reject`;
  const internalRejectionUrl = `${internalBaseUrl}/approve-request?token=${requestToken}&action=reject`;

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
        .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-top: 18px; margin-bottom: 8px; letter-spacing: 0.5px; }
        .actions-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
        .btn-approve-ext { background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; display: inline-block; box-shadow: 0 2px 4px rgba(22, 163, 74, 0.2); }
        .btn-approve-int { background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 12px; display: inline-block; }
        .btn-reject { background-color: #ef4444; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 12px; display: inline-block; }
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
            Seleccione la opción de aprobación según desde dónde está accediendo:
          </p>

          <!-- Opción 1: Acceso desde Internet / Red Externa -->
          <div class="actions-box">
            <div style="font-size: 12px; font-weight: 700; color: #15803d; margin-bottom: 6px;">
              🌐 Opción 1: Acceso desde Red Externa (Internet fuera del Hospital)
            </div>
            <a href="${externalApprovalUrl}" class="btn-approve-ext">✔ Aprobar Acceso (Red Externa)</a>
          </div>

          <!-- Opción 2: Acceso desde Red Interna del Hospital -->
          <div class="actions-box">
            <div style="font-size: 12px; font-weight: 700; color: #0369a1; margin-bottom: 6px;">
              🏥 Opción 2: Acceso desde Red Interna del Hospital (192.168.x.x)
            </div>
            <a href="${internalApprovalUrl}" class="btn-approve-int">✔ Aprobar Acceso (Red Interna)</a>
          </div>

          <div style="margin-top: 16px; text-align: center;">
            <a href="${externalRejectionUrl}" class="btn-reject">✖ Rechazar Solicitud</a>
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

export interface SendVerificationOtpEmailParams {
  toEmail: string;
  doctorName: string;
  otpCode: string;
}

export async function sendVerificationOtpEmail(params: SendVerificationOtpEmailParams) {
  const { toEmail, doctorName, otpCode } = params;

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
        .card { max-width: 550px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 28px; text-align: center; }
        .header h2 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; }
        .header p { margin: 6px 0 0 0; opacity: 0.85; font-size: 13px; color: #94a3b8; }
        .content { padding: 28px; text-align: center; }
        .otp-box { background: #f1f5f9; border: 2px dashed #0284c7; border-radius: 12px; padding: 20px; margin: 24px 0; display: inline-block; width: 80%; }
        .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #0284c7; margin: 0; }
        .badge-timer { background: #fef3c7; color: #b45309; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; display: inline-block; margin-top: 10px; }
        .footer { background: #f8fafc; padding: 18px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h2>🏥 HOSPITAL II-2 TARAPOTO</h2>
          <p>Verificación de Seguridad en 2 Pasos (FrontCQ)</p>
        </div>
        <div class="content">
          <p style="font-size: 15px; font-weight: 600; color: #334155; margin-bottom: 8px;">Estimado(a) ${doctorName},</p>
          <p style="font-size: 13px; color: #64748b; margin: 0;">
            Has solicitado validar tu correo electrónico para la confirmación de tu perfil asistencial en el sistema del Bloque Quirúrgico.
          </p>

          <div class="otp-box">
            <p style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; margin: 0 0 8px 0; letter-spacing: 1px;">Tu Código de Verificación OTP</p>
            <h1 class="otp-code">${otpCode}</h1>
            <div class="badge-timer">⏱️ Válido por 10 minutos</div>
          </div>

          <p style="font-size: 12px; color: #94a3b8; margin-top: 16px;">
            Si tú no realizaste esta solicitud, por favor ignora este mensaje. Ningún personal de la institución te pedirá este código.
          </p>
        </div>
        <div class="footer">
          Oficina de Tecnología de Información y Comunicación • OGESS Especializada - Tarapoto
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const fromAddress = process.env.SMTP_FROM || 'hospitaltarapotocoordinacion@gmail.com';
    await transporter.sendMail({
      from: `"FrontCQ - Sistema Quirúrgico" <${fromAddress}>`,
      to: toEmail,
      subject: `🔑 [Código OTP ${otpCode}] Verificación de Correo - Hospital II-2 Tarapoto`,
      html,
    });
    return { success: true };
  } catch (error) {
    console.error("Error enviando correo OTP de verificación:", error);
    return { success: false, error: String(error) };
  }
}
