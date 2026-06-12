"use server";

import { db } from "@/db";
import { 
    cqOperatingRooms, 
    cqSurgeries, 
    cqPatients, 
    cqPatientPii, 
    cqSurgeryTeam, 
    cqSurgicalReports, 
    cqSpecialties, 
    usersTable 
} from "@/db/schema";
import { sql, eq, and, inArray, desc, asc, isNull } from "drizzle-orm";
import { format, differenceInMinutes } from "date-fns";

export async function getDashboardStats(userId?: string) {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const firstDayOfMonthStr = format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd');

    // 1. Estadísticas Generales
    // Salas
    const [salasCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(cqOperatingRooms)
        .where(eq(cqOperatingRooms.status, 'available'));

    const allRooms = await db
        .select()
        .from(cqOperatingRooms)
        .orderBy(asc(cqOperatingRooms.name));

    // Cirugías Hoy
    const todaySurgeries = await db
        .select({ 
            surgery: cqSurgeries,
            patientPii: cqPatientPii,
            specialty: cqSpecialties
        })
        .from(cqSurgeries)
        .leftJoin(cqPatientPii, eq(cqSurgeries.patientId, cqPatientPii.patientId))
        .leftJoin(cqSpecialties, eq(cqSurgeries.specialtyId, cqSpecialties.id))
        .where(sql`DATE(scheduled_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima') = ${todayStr}::date`);

    const scheduledToday = todaySurgeries.filter(s => s.surgery.status === 'scheduled').length;
    const inProgressToday = todaySurgeries.filter(s => [
        'in_progress', 'anesthesia_start', 'pre_incision', 'surgery_end', 'patient_exit', 'urpa_exit'
    ].includes(s.surgery.status)).length;
    const completedToday = todaySurgeries.filter(s => s.surgery.status === 'completed').length;
    const cancelledToday = todaySurgeries.filter(s => s.surgery.status === 'cancelled').length;

    const electiveToday = todaySurgeries.filter(s => s.surgery.urgencyType === 'ELECTIVO' && s.surgery.status !== 'cancelled').length;
    const emergencyToday = todaySurgeries.filter(s => s.surgery.urgencyType === 'EMERGENCIA' && s.surgery.status !== 'cancelled').length;

    // Mes actual para tasa de suspensión
    const monthSurgeries = await db
        .select({ status: cqSurgeries.status })
        .from(cqSurgeries)
        .where(
            and(
                sql`DATE(scheduled_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima') >= ${firstDayOfMonthStr}::date`,
                sql`DATE(scheduled_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima') <= ${todayStr}::date`
            )
        );

    const completedThisMonth = monthSurgeries.filter(s => s.status === 'completed').length;
    const cancelledThisMonth = monthSurgeries.filter(s => s.status === 'cancelled').length;
    const totalThisMonth = monthSurgeries.length;
    const suspensionRate = totalThisMonth > 0 ? Number(((cancelledThisMonth / totalThisMonth) * 100).toFixed(1)) : 0;

    // Total pacientes empadronados
    const [pacientesCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(cqPatients);

    // 2. Obtener los equipos médicos asignados a las cirugías de hoy
    const todaySurgeryIds = todaySurgeries.map(s => s.surgery.id);
    let todayTeamsMap: Record<string, any[]> = {};

    if (todaySurgeryIds.length > 0) {
        const teams = await db
            .select({
                surgeryId: cqSurgeryTeam.surgeryId,
                role: cqSurgeryTeam.roleInSurgery,
                user: {
                    name: usersTable.name,
                    lastname: usersTable.lastname
                }
            })
            .from(cqSurgeryTeam)
            .innerJoin(usersTable, eq(cqSurgeryTeam.staffUserId, usersTable.id))
            .where(inArray(cqSurgeryTeam.surgeryId, todaySurgeryIds));

        teams.forEach(t => {
            if (!todayTeamsMap[t.surgeryId]) {
                todayTeamsMap[t.surgeryId] = [];
            }
            todayTeamsMap[t.surgeryId].push(t);
        });
    }

    // 3. Monitor de Quirófanos en Tiempo Real
    const activeStatuses = ['in_progress', 'anesthesia_start', 'pre_incision', 'surgery_end', 'patient_exit', 'urpa_exit'];
    
    const roomStatusList = allRooms.map(room => {
        // Buscar si hay alguna cirugía activa hoy en este quirófano
        const activeSurg = todaySurgeries.find(s => 
            s.surgery.operatingRoomId === room.id && 
            activeStatuses.includes(s.surgery.status)
        );

        if (activeSurg) {
            const team = todayTeamsMap[activeSurg.surgery.id] || [];
            const surgeon = team.find(t => t.role === 'CIRUJANO')?.user;
            const anesthesiologist = team.find(t => t.role === 'ANESTESIOLOGO')?.user;

            // Calcular progreso estimado (duración por defecto = 60 mins si no se puede parsear)
            let durationMins = 60;
            const rawDuration = activeSurg.surgery.estimatedDuration;
            if (rawDuration) {
                const match = rawDuration.match(/\d+/);
                if (match) {
                    const val = parseInt(match[0]);
                    if (rawDuration.toLowerCase().includes("hora")) {
                        durationMins = val * 60;
                    } else {
                        durationMins = val;
                    }
                }
            }

            let elapsedMins = 0;
            let progressPercent = 0;
            if (activeSurg.surgery.actualStartTime) {
                elapsedMins = differenceInMinutes(new Date(), new Date(activeSurg.surgery.actualStartTime));
                progressPercent = Math.min(100, Math.max(0, Math.round((elapsedMins / durationMins) * 100)));
            }

            return {
                roomId: room.id,
                roomName: room.name,
                roomStatus: 'occupied', // Forzar ocupado para vista
                surgeryId: activeSurg.surgery.id,
                status: activeSurg.surgery.status,
                patientName: `${activeSurg.patientPii?.nombres.split(' ')[0]} ${activeSurg.patientPii?.apellidos.split(' ')[0]}`,
                diagnosis: activeSurg.surgery.diagnosis || "Sin diagnóstico",
                specialty: activeSurg.specialty?.name || "Sin especialidad",
                surgeonName: surgeon ? `${surgeon.name.charAt(0)}. ${surgeon.lastname}` : "Por asignar",
                anesthesiologistName: anesthesiologist ? `${anesthesiologist.name.charAt(0)}. ${anesthesiologist.lastname}` : "Por asignar",
                elapsedMins,
                durationMins,
                progressPercent,
                urgencyType: activeSurg.surgery.urgencyType
            };
        }

        // Si no hay cirugía activa, buscar la siguiente programada para hoy en este quirófano
        const nextSurg = todaySurgeries
            .filter(s => s.surgery.operatingRoomId === room.id && s.surgery.status === 'scheduled')
            .sort((a, b) => new Date(a.surgery.scheduledDate).getTime() - new Date(b.surgery.scheduledDate).getTime())[0];

        return {
            roomId: room.id,
            roomName: room.name,
            roomStatus: room.status, // available, maintenance, etc.
            nextSurgery: nextSurg ? {
                id: nextSurg.surgery.id,
                time: format(new Date(nextSurg.surgery.scheduledDate), 'HH:mm'),
                patientName: `${nextSurg.patientPii?.nombres.split(' ')[0]} ${nextSurg.patientPii?.apellidos.split(' ')[0]}`,
                specialty: nextSurg.specialty?.name || "General"
            } : null
        };
    });

    // 4. Cirugías Activas / Próximas (Para retrocompatibilidad de UI)
    const activeSurgeries = todaySurgeries
        .filter(s => ['scheduled', ...activeStatuses].includes(s.surgery.status))
        .sort((a, b) => new Date(a.surgery.scheduledDate).getTime() - new Date(b.surgery.scheduledDate).getTime())
        .slice(0, 5)
        .map(s => ({
            id: s.surgery.id,
            scheduledDate: s.surgery.scheduledDate,
            status: s.surgery.status,
            urgencyType: s.surgery.urgencyType,
            diagnosis: s.surgery.diagnosis,
            operatingRoom: allRooms.find(r => r.id === s.surgery.operatingRoomId) || null,
            patient: { pii: s.patientPii }
        }));

    // 5. Últimos Pacientes Empadronados
    const latestPatients = await db
        .select({
            id: cqPatients.id,
            createdAt: cqPatients.createdAt,
            sexo: cqPatients.sexo,
            nombres: cqPatientPii.nombres,
            apellidos: cqPatientPii.apellidos,
            dni: cqPatientPii.dni,
            hc: cqPatientPii.historiaClinica
        })
        .from(cqPatients)
        .innerJoin(cqPatientPii, eq(cqPatients.id, cqPatientPii.patientId))
        .orderBy(desc(cqPatients.createdAt))
        .limit(4);

    // 6. Reportes Quirúrgicos Pendientes
    let pendingReports: any[] = [];
    if (userId) {
        pendingReports = await db
            .select({
                id: cqSurgeries.id,
                scheduledDate: cqSurgeries.scheduledDate,
                diagnosis: cqSurgeries.diagnosis,
                patient: {
                    nombres: cqPatientPii.nombres,
                    apellidos: cqPatientPii.apellidos,
                    historiaClinica: cqPatientPii.historiaClinica
                }
            })
            .from(cqSurgeries)
            .innerJoin(cqSurgeryTeam, and(
                eq(cqSurgeryTeam.surgeryId, cqSurgeries.id),
                eq(cqSurgeryTeam.staffUserId, userId),
                eq(cqSurgeryTeam.roleInSurgery, 'CIRUJANO')
            ))
            .innerJoin(cqPatientPii, eq(cqSurgeries.patientId, cqPatientPii.patientId))
            .leftJoin(cqSurgicalReports, eq(cqSurgicalReports.surgeryId, cqSurgeries.id))
            .where(and(
                inArray(cqSurgeries.status, ['completed', 'urpa_exit', 'patient_exit']),
                isNull(cqSurgicalReports.id)
            ))
            .orderBy(desc(cqSurgeries.scheduledDate))
            .limit(5);
    }

    // 7. Alertas de Seguridad Quirúrgica y Checklist
    const alerts: any[] = [];
    
    // Alerta de Tasa de Suspensión
    if (suspensionRate > 10) {
        alerts.push({
            id: 'suspension_rate',
            type: 'critical',
            message: `La tasa de suspensión de este mes es del ${suspensionRate}%, superando el límite del 10% establecido por el MINSA.`
        });
    }

    todaySurgeries.forEach(s => {
        const team = todayTeamsMap[s.surgery.id] || [];
        const hasAnesthesiologist = team.some(t => t.role === 'ANESTESIOLOGO');
        const hasNurse = team.some(t => t.role === 'ENFERMERO');
        const patientName = `${s.patientPii?.nombres.split(' ')[0]} ${s.patientPii?.apellidos.split(' ')[0]}`;

        // Alerta: Grupo Sanguíneo Faltante
        if (!s.patientPii?.bloodGroupRh && s.surgery.status !== 'cancelled') {
            alerts.push({
                id: `blood_${s.surgery.id}`,
                type: 'critical',
                message: `Paciente ${patientName} no tiene grupo sanguíneo (GFS) registrado para su cirugía programada.`
            });
        }

        // Alerta: Equipo Incompleto (Si es cirugía programada de hoy o si está activa)
        if (s.surgery.status !== 'cancelled' && s.surgery.status !== 'completed' && (!hasAnesthesiologist || !hasNurse)) {
            let missing = [];
            if (!hasAnesthesiologist) missing.push("Anestesiólogo");
            if (!hasNurse) missing.push("Enfermera");
            alerts.push({
                id: `team_${s.surgery.id}`,
                type: 'warning',
                message: `Cirugía de ${patientName} no tiene asignado: ${missing.join(" ni ")}.`
            });
        }
    });

    return {
        stats: {
            salasAvailable: Number(salasCount?.count || 0),
            scheduledToday,
            inProgressToday,
            completedToday,
            cancelledToday,
            completedThisMonth: Number(completedThisMonth),
            totalPacientes: Number(pacientesCount?.count || 0),
            suspensionRate,
            totalThisMonth,
            electiveToday,
            emergencyToday
        },
        activeSurgeries,
        latestPatients,
        roomStatusList,
        pendingReports,
        alerts,
        todaySurgeries: todaySurgeries.map(s => ({
            surgery: s.surgery,
            patientPii: s.patientPii,
            specialty: s.specialty
        }))
    };
}
