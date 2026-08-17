import { confirmContactVerificationOtpAction } from "../src/app/actions/account-request.js";

async function main() {
    try {
        console.log("=== PROBANDO CONFIRMACIÓN DEL CÓDIGO GENERADO 590387 ===");
        const userId = "1e9c80c1-d02e-43e7-b667-9f1a8b711271";
        const code = "590387";

        const confirmRes = await confirmContactVerificationOtpAction(userId, "email", code);
        console.log("Resultado de confirmación:", confirmRes);

        const postgres = (await import("postgres")).default;
        const sql = postgres(process.env.DATABASE_URL || "postgresql://jvp_user:V3l4p4r3d3s@localhost:6432/ogess");
        const updated = await sql`SELECT is_email_verified, email_verified_at FROM users WHERE id = ${userId}`;
        console.log("Estado de BD tras confirmación:", updated[0]);

        await sql.end();
        process.exit(0);
    } catch (err) {
        console.error("Error en prueba de confirmación:", err);
        process.exit(1);
    }
}

main();
