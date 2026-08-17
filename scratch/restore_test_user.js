import postgres from "postgres";

const connectionString = process.env.DATABASE_URL || "postgresql://jvp_user:V3l4p4r3d3s@localhost:6432/ogess";
const sql = postgres(connectionString);

async function main() {
    try {
        console.log("=== RESTABLECIENDO ESTADO INICIAL DE USUARIOS DE PRUEBA ===");

        await sql`
            UPDATE users
            SET is_email_verified = false,
                is_phone_verified = false,
                email_verified_at = null,
                phone_verified_at = null
            WHERE dni IN ('09791569', '42057668', '01146662', '40015104');
        `;

        console.log("✅ Estado de verificación restablecido exitosamente a su condición inicial.");

        await sql.end();
        process.exit(0);
    } catch (err) {
        console.error("Error al restablecer usuario:", err);
        await sql.end();
        process.exit(1);
    }
}

main();
