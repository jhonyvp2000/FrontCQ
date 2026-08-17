async function testTextbeltSMS() {
    console.log("=== PROBANDO ENVÍO REAL DE SMS VÍA TEXTBELT A +51955662693 ===");
    try {
        const response = await fetch("https://textbelt.com/text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                phone: "+51955662693",
                message: "HOSPITAL II-2 TARAPOTO: Tu codigo de verificacion OTP es 654321.",
                key: "textbelt"
            })
        });

        const data = await response.json();
        console.log("Respuesta Textbelt SMS:", data);
    } catch (err) {
        console.error("Error al enviar SMS vía Textbelt:", err);
    }
}

testTextbeltSMS();
