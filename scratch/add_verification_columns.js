import postgres from "postgres";

const connectionString = process.env.DATABASE_URL || "postgresql://jvp_user:V3l4p4r3d3s@localhost:6432/ogess";
const sql = postgres(connectionString);

async function main() {
    try {
        console.log("=== EJECUTANDO MIGRACIÓN DE CAMPOS DE VERIFICACIÓN ===");

        await sql`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
        `;

        console.log("✅ Columnas is_email_verified, is_phone_verified, email_verified_at, phone_verified_at agregadas/verificadas exitosamente en la tabla 'users'.");
        
        await sql.end();
        process.exit(0);
    } catch (err) {
        console.error("Error al ejecutar migración de columnas:", err);
        await sql.end();
        process.exit(1);
    }
}

main();
