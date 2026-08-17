import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { usersTable, staffProfiles, cqSurgeries, cqSurgeryTeam, cqPatientPii, professions } from "../src/db/schema.ts";
import { eq } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL || "postgresql://jvp_user:V3l4p4r3d3s@localhost:6432/ogess";
const client = postgres(connectionString);
const db = drizzle(client);

async function main() {
    try {
        console.log("=== BUSCANDO DATOS REALES PARA ACTIVACIÓN DE CUENTA DE PRUEBA ===");

        const rows = await db.select({
            userId: usersTable.id,
            dni: usersTable.dni,
            name: usersTable.name,
            lastname: usersTable.lastname,
            isActive: usersTable.isActive,
            tuitionCode: staffProfiles.tuitionCode,
            profession: professions.name,
            surgeryId: cqSurgeries.id,
            scheduledDate: cqSurgeries.scheduledDate,
            patientDni: cqPatientPii.dni,
            patientName: cqPatientPii.nombres,
            patientLastname: cqPatientPii.apellidos,
        })
        .from(usersTable)
        .innerJoin(staffProfiles, eq(usersTable.id, staffProfiles.userId))
        .innerJoin(professions, eq(staffProfiles.professionId, professions.id))
        .innerJoin(cqSurgeryTeam, eq(usersTable.id, cqSurgeryTeam.staffUserId))
        .innerJoin(cqSurgeries, eq(cqSurgeryTeam.surgeryId, cqSurgeries.id))
        .innerJoin(cqPatientPii, eq(cqSurgeries.patientId, cqPatientPii.patientId))
        .limit(10);

        console.log(`Encontrados ${rows.length} registros válidos:\n`);
        
        for (const row of rows) {
            const dateObj = new Date(row.scheduledDate);
            const formattedDate = dateObj.toISOString().split('T')[0];
            
            console.log(`----------------------------------------`);
            console.log(`👨‍⚕️ PERSONAL ASISTENCIAL:`);
            console.log(`  - Nombre: ${row.name} ${row.lastname}`);
            console.log(`  - DNI Personal: ${row.dni}`);
            console.log(`  - Colegiatura (CMP/CEP): ${row.tuitionCode || 'No registrado'}`);
            console.log(`  - Profesión: ${row.profession}`);
            console.log(`  - Estado Cuenta: ${row.isActive ? 'ACTIVA (Prueba set a inactive)' : 'INACTIVA'}`);
            console.log(`🏥 RETO QUIRÚRGICO (DATOS DE DESAFÍO):`);
            console.log(`  - DNI Paciente: ${row.patientDni}`);
            console.log(`  - Paciente: ${row.patientName} ${row.patientLastname}`);
            console.log(`  - Fecha Exacta (YYYY-MM-DD): ${formattedDate}`);
        }

        await client.end();
        process.exit(0);
    } catch (err) {
        console.error("Error al consultar datos de prueba:", err);
        await client.end();
        process.exit(1);
    }
}

main();
