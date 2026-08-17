import postgres from "postgres";

const connectionString = process.env.DATABASE_URL || "postgresql://jvp_user:V3l4p4r3d3s@localhost:6432/ogess";
const sql = postgres(connectionString);

async function main() {
    try {
        console.log("=== REVISANDO CUENTAS ACTIVAS CON SOLICITUD DE CUENTA Y REGISTRO COMPLETO ===");

        const reqs = await sql`
            SELECT req.id, req.dni, req.phone, req.status, req.user_id,
                   u.name, u.lastname, u.email, u.phone_number, u.is_email_verified, u.is_phone_verified
            FROM cq_account_requests req
            JOIN users u ON u.id = req.user_id
            WHERE u.is_active = true
            ORDER BY req.created_at DESC
            LIMIT 5;
        `;

        console.log(JSON.stringify(reqs, null, 2));

        await sql.end();
        process.exit(0);
    } catch (err) {
        console.error("Error al buscar solicitudes:", err);
        await sql.end();
        process.exit(1);
    }
}

main();
