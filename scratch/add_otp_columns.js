import postgres from "postgres";

const connectionString = process.env.DATABASE_URL || "postgresql://jvp_user:V3l4p4r3d3s@localhost:6432/ogess";
const sql = postgres(connectionString);

async function main() {
    try {
        console.log("=== AGREGANDO COLUMNAS DE ALMACENAMIENTO OTP EN TABLA USERS ===");

        await sql`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS email_otp_code VARCHAR(10),
            ADD COLUMN IF NOT EXISTS email_otp_expires_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS phone_otp_code VARCHAR(10),
            ADD COLUMN IF NOT EXISTS phone_otp_expires_at TIMESTAMPTZ;
        `;

        console.log("✅ Columnas email_otp_code, email_otp_expires_at, phone_otp_code, phone_otp_expires_at agregadas exitosamente.");

        await sql.end();
        process.exit(0);
    } catch (err) {
        console.error("Error al ejecutar migración OTP:", err);
        await sql.end();
        process.exit(1);
    }
}

main();
