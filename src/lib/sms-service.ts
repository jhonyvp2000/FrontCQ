export interface SendContactOtpSmsParams {
  phoneNumber: string;
  doctorName: string;
  otpCode: string;
}

export async function sendContactOtpSms(params: SendContactOtpSmsParams) {
  const { phoneNumber, doctorName, otpCode } = params;
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  const messageText = `HOSPITAL II-2 TARAPOTO: Hola ${doctorName}, tu código de verificación OTP de 6 dígitos es: ${otpCode}. Válido por 10 min.`;

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
        return { success: false, error: errText, loggedOnly: true };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error("Error al conectar con la pasarela SMS:", error);
      return { success: false, error: String(error), loggedOnly: true };
    }
  }

  // If no SMS gateway endpoint is configured in .env, record in system logs
  return { 
    success: true, 
    loggedOnly: true, 
    message: "Mensaje SMS registrado en auditoría de servidor. Configure SMS_GATEWAY_URL para despacho automático por red celular." 
  };
}
