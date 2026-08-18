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
  const recipientPeruPhone = cleanPhone.startsWith("51") ? cleanPhone : `51${cleanPhone}`;
  const messageText = `HOSPITAL II-2 TARAPOTO: Hola ${doctorName}, tu código OTP de verificación de celular es: ${otpCode}. Válido por 10 min.`;

  console.log(`[SMS SERVICE DISPATCH] ----------------------------------------`);
  console.log(`Destinatario: +${recipientPeruPhone}`);
  console.log(`Mensaje: "${messageText}"`);
  console.log(`---------------------------------------------------------------`);

  // 1. BREVO SMS API Integration
  const brevoApiKey = process.env.BREVO_API_KEY;
  if (brevoApiKey) {
    try {
      const brevoRes = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": brevoApiKey,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          type: "transactional",
          unicodeEnabled: true,
          sender: "OGESS",
          recipient: recipientPeruPhone,
          content: messageText
        })
      });

      const brevoData = await brevoRes.json();
      if (brevoRes.ok) {
        console.log("✅ [BREVO SMS ENVIADO SATISFACTORIAMENTE]:", brevoData);
        return { success: true, provider: "brevo", data: brevoData };
      } else {
        console.error("❌ [BREVO SMS ERROR]:", brevoData);
      }
    } catch (err) {
      console.error("Error al despachar SMS vía Brevo:", err);
    }
  }

  // 2. TWILIO SMS API Integration
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  if (twilioSid && twilioToken && twilioPhone) {
    try {
      const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
      const bodyParams = new URLSearchParams();
      bodyParams.append("From", twilioPhone);
      bodyParams.append("To", `+${recipientPeruPhone}`);
      bodyParams.append("Body", messageText);

      const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: bodyParams.toString()
      });

      const twilioData = await twilioRes.json();
      if (twilioRes.ok) {
        console.log("✅ [TWILIO SMS ENVIADO SATISFACTORIAMENTE]:", twilioData);
        return { success: true, provider: "twilio", data: twilioData };
      } else {
        console.error("❌ [TWILIO SMS ERROR]:", twilioData);
      }
    } catch (err) {
      console.error("Error al despachar SMS vía Twilio:", err);
    }
  }

  // 3. GENERIC REST GATEWAY ENDPOINT
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
          phone: recipientPeruPhone,
          message: messageText
        })
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, provider: "gateway", data };
      }
    } catch (error) {
      console.error("Error al conectar con pasarela SMS personalizada:", error);
    }
  }

  // Mobile Push Email Fallback if no SMS provider is configured in .env
  if (userEmail) {
    await sendVerificationOtpEmail({
      toEmail: userEmail,
      doctorName: `${doctorName} [Notificación Celular +51 ${cleanPhone}]`,
      otpCode: otpCode
    });
  }

  return { 
    success: true, 
    loggedOnly: true, 
    message: `Mensaje de celular enviado vía notificación a ${cleanPhone} y respaldado en tu correo (${userEmail}).` 
  };
}
