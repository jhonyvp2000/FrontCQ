import postgres from "postgres";

const connectionString = process.env.DATABASE_URL || "postgresql://jvp_user:V3l4p4r3d3s@localhost:6432/ogess";
const sql = postgres(connectionString);

async function main() {
    try {
        console.log("=== RESETEANDO ESTADO DE VERIFICACIÓN A PENDIENTE (DNI 09791569) ===");

        await sql`
            UPDATE users
            SET is_email_verified = false,
                is_phone_verified = false,
                email_verified_at = null,
                phone_verified_at = null,
                email_otp_code = null,
                email_otp_expires_at = null,
                phone_otp_code = null,
                phone_otp_expires_at = null
            WHERE dni = '09791569';
        `;

        const check = await sql`
            SELECT id, dni, name, lastname, email, phone_number, is_email_verified, is_phone_verified
            FROM users
            WHERE dni = '09791569';
        `;

        console.log("✅ Usuario reseteado a PENDIENTE:");
        console.log(JSON.stringify(check[0], null, 2));

        await sql.end();
        process.exit(0);
    } catch (err) {
        console.error("Error al resetear usuario:", err);
        await sql.end();
        process.exit(1);
    }
}

main();
