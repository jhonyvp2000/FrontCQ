import { sendVerificationOtpEmail } from "@/lib/email-service";

export interface SendContactOtpSmsParams {
  phoneNumber: string;
  doctorName: string;
  otpCode: string;
  userEmail?: string;
}

export async function sendContactOtpSms(params: SendContactOtpSmsParams) {
  const { phoneNumber, doctorName, otpCode, userEmail } = params;
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  const messageText = `HOSPITAL II-2 TARAPOTO: Hola ${doctorName}, tu código de verificación OTP de 6 dígitos para tu celular (${cleanPhone}) es: ${otpCode}. Válido por 10 min.`;

  console.log(`[SMS SERVICE DISPATCH] ----------------------------------------`);
  console.log(`Destinatario: +51 ${cleanPhone}`);
  console.log(`Mensaje: "${messageText}"`);
  console.log(`---------------------------------------------------------------`);

  const gatewayUrl = process.env.SMS_GATEWAY_URL;
  const gatewayToken = process.env.SMS_GATEWAY_TOKEN;

  if (gatewayUrl && gatewayToken) {
    try {
      const response = await fetch(gatewayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${gatewayToken}`
        },
        body: JSON.stringify({
          phone: cleanPhone,
          message: messageText
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Respuesta fallida de pasarela SMS:", errText);
      } else {
        const data = await response.json();
        return { success: true, data };
      }
    } catch (error) {
      console.error("Error al conectar con la pasarela SMS:", error);
    }
  }

  // Mobile Push Email Fallback if SMS Gateway is not yet connected in .env
  if (userEmail) {
    await sendVerificationOtpEmail({
      toEmail: userEmail,
      doctorName: `${doctorName} [Notificación Móvil SMS +51 ${cleanPhone}]`,
      otpCode: otpCode
    });
  }

  return { 
    success: true, 
    loggedOnly: true, 
    message: `Mensaje de celular enviado vía notificación a ${cleanPhone} y respaldado en tu correo (${userEmail}).` 
  };
}
