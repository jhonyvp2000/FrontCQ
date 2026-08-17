import { confirmContactVerificationOtpAction, sendContactVerificationOtpAction } from "../src/app/actions/account-request.js";

async function main() {
    try {
        console.log("=== PROBANDO CONFIRMACIÓN DE OTP ===");
        const userId = "1e9c80c1-d02e-43e7-b667-9f1a8b711271";

        // 1. Send OTP
        const sendRes = await sendContactVerificationOtpAction(userId, "email");
        console.log("Respuesta de envío:", sendRes);

        // 2. Inspect database
        const postgres = (await import("postgres")).default;
        const sql = postgres(process.env.DATABASE_URL || "postgresql://jvp_user:V3l4p4r3d3s@localhost:6432/ogess");
        const user = await sql`SELECT email_otp_code FROM users WHERE id = ${userId}`;
        const code = user[0].email_otp_code;
        console.log("Código OTP generado en BD:", code);

        // 3. Confirm OTP
        const confirmRes = await confirmContactVerificationOtpAction(userId, "email", code);
        console.log("Respuesta de confirmación:", confirmRes);

        // 4. Verify DB state
        const updated = await sql`SELECT is_email_verified, email_verified_at FROM users WHERE id = ${userId}`;
        console.log("Estado de BD actualizado:", updated[0]);

        await sql.end();
        process.exit(0);
    } catch (err) {
        console.error("Error en test de confirmación:", err);
        process.exit(1);
    }
}

main();
