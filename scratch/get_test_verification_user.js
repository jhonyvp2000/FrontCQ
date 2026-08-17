import postgres from "postgres";

const connectionString = process.env.DATABASE_URL || "postgresql://jvp_user:V3l4p4r3d3s@localhost:6432/ogess";
const sql = postgres(connectionString);

async function main() {
    try {
        console.log("=== BUSCANDO USUARIO PARA PRUEBAS DE VERIFICACIÓN 2-STEP ===");

        const users = await sql`
            SELECT u.id, u.dni, u.name, u.lastname, u.email, u.phone_number, u.is_active, 
                   u.is_email_verified, u.is_phone_verified, u.email_verified_at, u.phone_verified_at,
                   usr.system_id, r.name as role_name
            FROM users u
            JOIN user_system_roles usr ON usr.user_id = u.id
            JOIN roles r ON r.id = usr.role_id
            WHERE u.is_active = true AND usr.system_id = 'backcq'
            LIMIT 5;
        `;

        console.log(JSON.stringify(users, null, 2));

        await sql.end();
        process.exit(0);
    } catch (err) {
        console.error("Error al buscar usuario:", err);
        await sql.end();
        process.exit(1);
    }
}

main();
