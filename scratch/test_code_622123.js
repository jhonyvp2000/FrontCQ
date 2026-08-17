import { confirmContactVerificationOtpAction } from "../src/app/actions/account-request.js";

async function main() {
    try {
        console.log("=== PROBANDO CONFIRMACIÓN DEL CÓDIGO REAL DE LA BD: 622123 ===");
        const userId = "1e9c80c1-d02e-43e7-b667-9f1a8b711271";
        const code = "622123";

        const res = await confirmContactVerificationOtpAction(userId, "email", code);
        console.log("Resultado de confirmContactVerificationOtpAction:", res);

        await sqlEnd();
        process.exit(0);
    } catch (err) {
        console.error("Error al probar:", err);
        process.exit(1);
    }
}

async function sqlEnd() {
    const postgres = (await import("postgres")).default;
    const sql = postgres(process.env.DATABASE_URL || "postgresql://jvp_user:V3l4p4r3d3s@localhost:6432/ogess");
    const updated = await sql`SELECT is_email_verified, email_verified_at FROM users WHERE id = '1e9c80c1-d02e-43e7-b667-9f1a8b711271'`;
    console.log("Estado de BD tras confirmación:", updated[0]);
    await sql.end();
}

main();
