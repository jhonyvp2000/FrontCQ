import postgres from "postgres";

const connectionString = process.env.DATABASE_URL || "postgresql://jvp_user:V3l4p4r3d3s@localhost:6432/ogess";
const sql = postgres(connectionString);

async function main() {
    try {
        console.log("=== ANOTANDO ESTADO INICIAL DEL USUARIO DE PRUEBAS ===");

        const user = await sql`
            SELECT id, dni, name, lastname, email, phone_number, is_email_verified, is_phone_verified, email_verified_at, phone_verified_at
            FROM users
            WHERE dni = '09791569';
        `;

        console.log("ESTADO INICIAL RESPALDADO:");
        console.log(JSON.stringify(user[0], null, 2));

        await sql.end();
        process.exit(0);
    } catch (err) {
        console.error("Error al obtener backup:", err);
        await sql.end();
        process.exit(1);
    }
}

main();
