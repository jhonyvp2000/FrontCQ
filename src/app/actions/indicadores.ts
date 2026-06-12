"use server";

import { db } from "@/db";
import { 
  cqSurgeries, cqSpecialties, cqInterventionTypes, cqSurgeryInterventions
} from "@/db/schema";
import { eq, and, gte, lte, inArray, sql, not } from "drizzle-orm";

export async function fetchIndicatorsReport(month: number, year: number) {
    const startDate = new Date(year, month - 1, 1, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // 1. Obtener todas las especialidades activas
    const specialties = await db.select().from(cqSpecialties).where(eq(cqSpecialties.isActive, true));

    // 2. Obtener todas las cirugías del rango
    const surgeries = await db.select({
        id: cqSurgeries.id,
        specialtyId: cqSurgeries.specialtyId,
        urgencyType: cqSurgeries.urgencyType,
        status: cqSurgeries.status,
        isDeathByEmergency: cqSurgeries.isDeathByEmergency
    })
    .from(cqSurgeries)
    .where(and(
        gte(cqSurgeries.scheduledDate, startDate),
        lte(cqSurgeries.scheduledDate, endDate)
    ));

    // 3. Obtener intervenciones de LU y AMEU para estas cirugías
    const surgeryIds = surgeries.map(s => s.id);
    let luAmeuMap: Record<string, { isLU: boolean, isAMEU: boolean }> = {};

    if (surgeryIds.length > 0) {
        const interventions = await db.select({
            surgeryId: cqSurgeryInterventions.surgeryId,
            name: cqInterventionTypes.name
        })
        .from(cqSurgeryInterventions)
        .innerJoin(cqInterventionTypes, eq(cqSurgeryInterventions.interventionId, cqInterventionTypes.id))
        .where(and(
            inArray(cqSurgeryInterventions.surgeryId, surgeryIds),
            inArray(cqInterventionTypes.name, ['LEGRADO UTERINO', 'ASPIRACIÓN MANUAL ENDOUTERINA'])
        ));

        interventions.forEach(int => {
            if (!luAmeuMap[int.surgeryId]) luAmeuMap[int.surgeryId] = { isLU: false, isAMEU: false };
            if (int.name === 'LEGRADO UTERINO') luAmeuMap[int.surgeryId].isLU = true;
            if (int.name === 'ASPIRACIÓN MANUAL ENDOUTERINA') luAmeuMap[int.surgeryId].isAMEU = true;
        });
    }

    // 4. Procesar y agrupar
    const report = specialties.map(spec => {
        const specSurgeries = surgeries.filter(s => s.specialtyId === spec.id);
        
        const prog = specSurgeries.filter(s => s.urgencyType === 'ELECTIVO' && s.status !== 'cancelled').length;
        const susp = specSurgeries.filter(s => s.status === 'cancelled').length;
        const emg = specSurgeries.filter(s => s.urgencyType === 'EMERGENCIA' && s.status !== 'cancelled').length;
        const muerteEmer = specSurgeries.filter(s => s.isDeathByEmergency).length;
        
        // LU y AMEU (Normalmente son Ginecología, pero filtramos por intervención en cualquier especialidad por seguridad)
        const luProg = specSurgeries.filter(s => s.urgencyType === 'ELECTIVO' && luAmeuMap[s.id]?.isLU).length;
        const luEmer = specSurgeries.filter(s => s.urgencyType === 'EMERGENCIA' && luAmeuMap[s.id]?.isLU).length;
        const ameuProg = specSurgeries.filter(s => s.urgencyType === 'ELECTIVO' && luAmeuMap[s.id]?.isAMEU).length;
        const ameuEmer = specSurgeries.filter(s => s.urgencyType === 'EMERGENCIA' && luAmeuMap[s.id]?.isAMEU).length;

        const totalEfectivas = prog + emg; // Según lógica de imagen, efectivas son las realizadas
        const total = totalEfectivas + susp;

        return {
            especialidad: spec.name,
            prog,
            susp,
            emg,
            muerteEmer,
            luProg,
            luEmer,
            ameuProg,
            ameuEmer,
            totalEfectivas,
            total
        };
    });

    return report;
}

export async function fetchInterventionsReport(month: number, year: number) {
    const startDate = new Date(year, month - 1, 1, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // 1. Obtener todas las especialidades activas
    const specialties = await db.select().from(cqSpecialties).where(eq(cqSpecialties.isActive, true));

    // 2. Obtener los conteos de intervenciones por especialidad (excluyendo cirugías canceladas)
    const queryResults = await db.select({
        specialtyId: cqSurgeries.specialtyId,
        specialtyName: cqSpecialties.name,
        interventionName: cqInterventionTypes.name,
        count: sql<number>`count(*)`
    })
    .from(cqSurgeryInterventions)
    .innerJoin(cqSurgeries, eq(cqSurgeryInterventions.surgeryId, cqSurgeries.id))
    .innerJoin(cqSpecialties, eq(cqSurgeries.specialtyId, cqSpecialties.id))
    .innerJoin(cqInterventionTypes, eq(cqSurgeryInterventions.interventionId, cqInterventionTypes.id))
    .where(and(
        gte(cqSurgeries.scheduledDate, startDate),
        lte(cqSurgeries.scheduledDate, endDate),
        not(eq(cqSurgeries.status, 'cancelled'))
    ))
    .groupBy(cqSurgeries.specialtyId, cqSpecialties.name, cqInterventionTypes.name)
    .orderBy(cqSpecialties.name, sql`count(*) DESC`);

    // 3. Agrupar resultados en un mapa de especialidad -> intervenciones
    const groupedBySpecialty: Record<string, { interventionName: string, count: number }[]> = {};
    
    queryResults.forEach(r => {
        const specName = r.specialtyName || 'SIN ESPECIALIDAD';
        if (!groupedBySpecialty[specName]) {
            groupedBySpecialty[specName] = [];
        }
        groupedBySpecialty[specName].push({
            interventionName: r.interventionName,
            count: Number(r.count)
        });
    });

    // 4. Calcular estadísticas del bloque de resumen al final
    // Conteo total de cirugías programadas (incluyendo canceladas)
    const totalProgramadasQuery = await db.select({
        count: sql<number>`count(*)`
    })
    .from(cqSurgeries)
    .where(and(
        gte(cqSurgeries.scheduledDate, startDate),
        lte(cqSurgeries.scheduledDate, endDate)
    ));
    const totalProgramadas = Number(totalProgramadasQuery[0]?.count || 0);

    // Conteo de cirugías suspendidas agrupadas por motivo
    const suspensionesQuery = await db.select({
        reason: cqSurgeries.cancellationReason,
        count: sql<number>`count(*)`
    })
    .from(cqSurgeries)
    .where(and(
        gte(cqSurgeries.scheduledDate, startDate),
        lte(cqSurgeries.scheduledDate, endDate),
        eq(cqSurgeries.status, 'cancelled')
    ))
    .groupBy(cqSurgeries.cancellationReason)
    .orderBy(sql`count(*) DESC`);

    const suspensiones = suspensionesQuery.map(s => ({
        reason: s.reason || 'SIN MOTIVO ESPECIFICADO',
        count: Number(s.count)
    }));

    const totalSuspended = suspensiones.reduce((sum, item) => sum + item.count, 0);
    const totalRealizadas = totalProgramadas - totalSuspended;

    return {
        groupedBySpecialty,
        summary: {
            totalProgramadas,
            suspensiones,
            totalRealizadas
        }
    };
}

export async function fetchInterventionIndicatorsReport(month: number, year: number) {
    const startDate = new Date(year, month - 1, 1, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // 1. Obtener todas las cirugías del rango
    const surgeries = await db.select({
        id: cqSurgeries.id,
        urgencyType: cqSurgeries.urgencyType,
        status: cqSurgeries.status,
        isDeathByEmergency: cqSurgeries.isDeathByEmergency
    })
    .from(cqSurgeries)
    .where(and(
        gte(cqSurgeries.scheduledDate, startDate),
        lte(cqSurgeries.scheduledDate, endDate)
    ));

    if (surgeries.length === 0) return [];

    const surgeryIds = surgeries.map(s => s.id);

    // 2. Obtener las intervenciones de estas cirugías
    const surgeryInterventions = await db.select({
        surgeryId: cqSurgeryInterventions.surgeryId,
        interventionId: cqSurgeryInterventions.interventionId,
        name: cqInterventionTypes.name
    })
    .from(cqSurgeryInterventions)
    .innerJoin(cqInterventionTypes, eq(cqSurgeryInterventions.interventionId, cqInterventionTypes.id))
    .where(inArray(cqSurgeryInterventions.surgeryId, surgeryIds));

    // Mapear cada cirugía a sus intervenciones
    const surgeryToInterventions: Record<string, { id: string, name: string }[]> = {};
    surgeryInterventions.forEach(si => {
        if (!surgeryToInterventions[si.surgeryId]) {
            surgeryToInterventions[si.surgeryId] = [];
        }
        surgeryToInterventions[si.surgeryId].push({ id: si.interventionId, name: si.name });
    });

    // Banderas de LU y AMEU por cirugía
    const luAmeuMap: Record<string, { isLU: boolean, isAMEU: boolean }> = {};
    surgeryInterventions.forEach(si => {
        if (!luAmeuMap[si.surgeryId]) luAmeuMap[si.surgeryId] = { isLU: false, isAMEU: false };
        if (si.name === 'LEGRADO UTERINO') luAmeuMap[si.surgeryId].isLU = true;
        if (si.name === 'ASPIRACIÓN MANUAL ENDOUTERINA') luAmeuMap[si.surgeryId].isAMEU = true;
    });

    // 3. Agrupar cirugías por tipo de intervención (1-a-N)
    const groups: Record<string, { name: string, surgeries: typeof surgeries }> = {};
    const UNASSIGNED_ID = "sin-especificar";
    groups[UNASSIGNED_ID] = { name: "SIN ESPECIFICAR", surgeries: [] };

    surgeries.forEach(s => {
        const ints = surgeryToInterventions[s.id];
        if (ints && ints.length > 0) {
            ints.forEach(int => {
                if (!groups[int.id]) {
                    groups[int.id] = { name: int.name, surgeries: [] };
                }
                groups[int.id].surgeries.push(s);
            });
        } else {
            groups[UNASSIGNED_ID].surgeries.push(s);
        }
    });

    // 4. Calcular métricas para cada grupo
    const report = Object.entries(groups)
        .map(([id, group]) => {
            const groupSurgeries = group.surgeries;
            
            const prog = groupSurgeries.filter(s => s.urgencyType === 'ELECTIVO' && s.status !== 'cancelled').length;
            const susp = groupSurgeries.filter(s => s.status === 'cancelled').length;
            const emg = groupSurgeries.filter(s => s.urgencyType === 'EMERGENCIA' && s.status !== 'cancelled').length;
            const muerteEmer = groupSurgeries.filter(s => s.isDeathByEmergency).length;
            
            const luProg = groupSurgeries.filter(s => s.urgencyType === 'ELECTIVO' && luAmeuMap[s.id]?.isLU).length;
            const luEmer = groupSurgeries.filter(s => s.urgencyType === 'EMERGENCIA' && luAmeuMap[s.id]?.isLU).length;
            const ameuProg = groupSurgeries.filter(s => s.urgencyType === 'ELECTIVO' && luAmeuMap[s.id]?.isAMEU).length;
            const ameuEmer = groupSurgeries.filter(s => s.urgencyType === 'EMERGENCIA' && luAmeuMap[s.id]?.isAMEU).length;

            const totalEfectivas = prog + emg;
            const total = totalEfectivas + susp;

            return {
                id,
                tipoIntervencion: group.name,
                prog,
                susp,
                emg,
                muerteEmer,
                luProg,
                luEmer,
                ameuProg,
                ameuEmer,
                totalEfectivas,
                total
            };
        })
        .filter(item => item.total > 0)
        .sort((a, b) => {
            if (a.id === UNASSIGNED_ID) return 1;
            if (b.id === UNASSIGNED_ID) return -1;
            return a.tipoIntervencion.localeCompare(b.tipoIntervencion);
        });

    return report;
}

export async function fetchHospitalIndicatorsReport(month: number, year: number) {
    const startDate = new Date(year, month - 1, 1, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    const daysInMonth = new Date(year, month, 0).getDate();

    // 1. Obtener todas las cirugías del rango
    const surgeries = await db.select({
        id: cqSurgeries.id,
        patientId: cqSurgeries.patientId,
        status: cqSurgeries.status,
        urgencyType: cqSurgeries.urgencyType,
        actualStartTime: cqSurgeries.actualStartTime,
        surgeryEndTime: cqSurgeries.surgeryEndTime,
        patientExitTime: cqSurgeries.patientExitTime,
        urpaExitTime: cqSurgeries.urpaExitTime,
        isDeathByEmergency: cqSurgeries.isDeathByEmergency,
        isReintervention: cqSurgeries.isReintervention,
        hasHypoxicEncephalopathy: cqSurgeries.hasHypoxicEncephalopathy,
        hasUrpaComplication: cqSurgeries.hasUrpaComplication,
        diedInSurgery: cqSurgeries.diedInSurgery,
        diedInUrpa: cqSurgeries.diedInUrpa,
    })
    .from(cqSurgeries)
    .where(and(
        gte(cqSurgeries.scheduledDate, startDate),
        lte(cqSurgeries.scheduledDate, endDate)
    ));

    const completedSurgeries = surgeries.filter(s => s.status === 'completed');
    const cancelledSurgeries = surgeries.filter(s => s.status === 'cancelled');
    const totalExecuted = completedSurgeries.length;

    const completedElective = completedSurgeries.filter(s => s.urgencyType === 'ELECTIVO');
    const completedEmergency = completedSurgeries.filter(s => s.urgencyType === 'EMERGENCIA');
    const cancelledElective = cancelledSurgeries.filter(s => s.urgencyType === 'ELECTIVO');

    // Auxiliar para duraciones en horas
    const getDurationHours = (start: Date | null, end: Date | null) => {
        if (!start || !end) return 0;
        const diff = end.getTime() - start.getTime();
        return diff > 0 ? diff / (3600 * 1000) : 0;
    };

    // 1. Rendimiento salas (24h)
    const rendSalas24h = totalExecuted / 5;

    // 2. Rendimiento salas emergencias (2 salas)
    const rendSalasEmerg = completedEmergency.length / 2;

    // 3. Rendimiento salas electivas (3 salas)
    const rendSalasElect = completedElective.length / 3;

    // 4. Porcentaje de suspensiones quirúrgicas
    const suspNumerator = cancelledElective.length;
    const suspDenominator = completedElective.length + cancelledElective.length;
    const porcSuspensiones = suspDenominator > 0 ? (suspNumerator * 100) / suspDenominator : 0;

    // 5. Horas efectivas (Emergencia) - disponibles = 2 salas * 24 horas * días
    const horasEfectivasEmerg = completedEmergency.reduce((sum, s) => sum + getDurationHours(s.actualStartTime, s.surgeryEndTime), 0);
    const horasDisponiblesEmerg = 2 * 24 * daysInMonth;
    const porcHorasEfectivasEmerg = horasDisponiblesEmerg > 0 ? (horasEfectivasEmerg * 100) / horasDisponiblesEmerg : 0;

    // 6. Horas efectivas (Programadas/Electivas) - disponibles = 3 salas * 12 horas * días
    const horasEfectivasElect = completedElective.reduce((sum, s) => sum + getDurationHours(s.actualStartTime, s.surgeryEndTime), 0);
    const horasDisponiblesElect = 3 * 12 * daysInMonth;
    const porcHorasEfectivasElect = horasDisponiblesElect > 0 ? (horasEfectivasElect * 100) / horasDisponiblesElect : 0;

    // 7. Horas efectivas (Consolidado)
    const horasEfectivasTotal = horasEfectivasEmerg + horasEfectivasElect;
    const horasDisponiblesTotal = horasDisponiblesEmerg + horasDisponiblesElect;
    const porcHorasEfectivasConsolidado = horasDisponiblesTotal > 0 ? (horasEfectivasTotal * 100) / horasDisponiblesTotal : 0;

    // 8. Porcentaje de cirugías de emergencia
    const porcCirugiasEmerg = totalExecuted > 0 ? (completedEmergency.length * 100) / totalExecuted : 0;

    // Pacientes Únicos
    const uniquePatientsCount = new Set(completedSurgeries.map(s => s.patientId)).size;

    // 9. Tasa de Encefalopatía Hipóxica (por 100 o porcentaje)
    const encefalopatiaCount = completedSurgeries.filter(s => s.hasHypoxicEncephalopathy).length;
    const tasaEncefalopatia = uniquePatientsCount > 0 ? (encefalopatiaCount * 100) / uniquePatientsCount : 0;

    // 10. Tasa de Mortalidad en CQ (fallecido en Qx + fallecido en URPA + fallecido por emergencia)
    const totalDeaths = completedSurgeries.filter(s => s.diedInSurgery || s.diedInUrpa || (s.urgencyType === 'EMERGENCIA' && s.isDeathByEmergency)).length;
    const tasaMortalidad = uniquePatientsCount > 0 ? (totalDeaths * 100) / uniquePatientsCount : 0;

    // 11. Tasa de pacientes reintervenidos
    const reintervenidosCount = completedSurgeries.filter(s => s.isReintervention).length;
    const tasaReintervenidos = uniquePatientsCount > 0 ? (reintervenidosCount * 100) / uniquePatientsCount : 0;

    // 12. Grado de cumplimiento de operaciones programadas
    const cumplimientoNumerator = completedElective.length;
    const cumplimientoDenominator = completedElective.length + cancelledElective.length;
    const gradoCumplimiento = cumplimientoDenominator > 0 ? (cumplimientoNumerator * 100) / cumplimientoDenominator : 0;

    // 13. Pacientes que ingresan a URPA
    const pacientesIngresanUrpa = completedSurgeries.filter(s => s.urpaExitTime !== null).length;

    // 14. Porcentaje de complicaciones en URPA
    const complicacionesUrpaCount = completedSurgeries.filter(s => s.hasUrpaComplication).length;
    const porcComplicacionesUrpa = totalExecuted > 0 ? (complicacionesUrpaCount * 100) / totalExecuted : 0;

    // 15. Porcentaje de permanencia en URPA (ocupación de camas URPA: 2 camas * 24 horas * días)
    const permanenciaUrpaHoras = completedSurgeries.reduce((sum, s) => sum + getDurationHours(s.patientExitTime, s.urpaExitTime), 0);
    const disponibleUrpaHoras = 2 * 24 * daysInMonth;
    const porcPermanenciaUrpa = disponibleUrpaHoras > 0 ? (permanenciaUrpaHoras * 100) / disponibleUrpaHoras : 0;

    return {
        mes: month,
        anio: year,
        diasEnMes: daysInMonth,
        totalEjecutadas: totalExecuted,
        totalCanceladas: cancelledSurgeries.length,
        totalProgramadasElectivas: completedElective.length + cancelledElective.length,
        pacientesUnicos: uniquePatientsCount,
        pacientesUrpa: pacientesIngresanUrpa,
        
        indicadores: [
            {
                id: 1,
                nombre: "Rendimiento de salas de operaciones (24h)",
                formula: "Total Intervenciones Ejecutadas / Nro. Salas (5)",
                numerador: totalExecuted,
                denominador: 5,
                valor: parseFloat(rendSalas24h.toFixed(2)),
                unidad: "operaciones/sala"
            },
            {
                id: 2,
                nombre: "Rendimiento de salas de operaciones (Emergencia)",
                formula: "Total Intervenciones EMG / Nro. Salas EMG (2)",
                numerador: completedEmergency.length,
                denominador: 2,
                valor: parseFloat(rendSalasEmerg.toFixed(2)),
                unidad: "operaciones/sala"
            },
            {
                id: 3,
                nombre: "Rendimiento de salas de operaciones (Electivas)",
                formula: "Total Intervenciones Electivas / Nro. Salas Electivas (3)",
                numerador: completedElective.length,
                denominador: 3,
                valor: parseFloat(rendSalasElect.toFixed(2)),
                unidad: "operaciones/sala"
            },
            {
                id: 4,
                nombre: "Porcentaje de intervenciones quirúrgicas suspendidas",
                formula: "(Cirugías Canceladas Electivas * 100) / Total Programadas (Electivas)",
                numerador: suspNumerator,
                denominador: suspDenominator,
                valor: parseFloat(porcSuspensiones.toFixed(2)),
                unidad: "%"
            },
            {
                id: 5,
                nombre: "Porcentaje de horas quirúrgicas efectivas (Emergencia)",
                formula: "(Horas EMG Efectivas * 100) / (2 salas * 24h * días del mes)",
                numerador: parseFloat(horasEfectivasEmerg.toFixed(2)),
                denominador: horasDisponiblesEmerg,
                valor: parseFloat(porcHorasEfectivasEmerg.toFixed(2)),
                unidad: "%"
            },
            {
                id: 6,
                nombre: "Porcentaje de horas quirúrgicas efectivas (Electivas)",
                formula: "(Horas Electivas Efectivas * 100) / (3 salas * 12h * días del mes)",
                numerador: parseFloat(horasEfectivasElect.toFixed(2)),
                denominador: horasDisponiblesElect,
                valor: parseFloat(porcHorasEfectivasElect.toFixed(2)),
                unidad: "%"
            },
            {
                id: 7,
                nombre: "Porcentaje de horas quirúrgicas efectivas (Consolidado)",
                formula: "(Horas Efectivas Totales * 100) / Horas Disponibles Totales",
                numerador: parseFloat(horasEfectivasTotal.toFixed(2)),
                denominador: horasDisponiblesTotal,
                valor: parseFloat(porcHorasEfectivasConsolidado.toFixed(2)),
                unidad: "%"
            },
            {
                id: 8,
                nombre: "Porcentaje de intervenciones quirúrgicas de emergencia",
                formula: "(Total Intervenciones EMG * 100) / Total Intervenciones Ejecutadas",
                numerador: completedEmergency.length,
                denominador: totalExecuted,
                valor: parseFloat(porcCirugiasEmerg.toFixed(2)),
                unidad: "%"
            },
            {
                id: 9,
                nombre: "Tasa de pacientes con encefalopatía hipóxica post-acto quirúrgico",
                formula: "(Pacientes con Encefalopatía * 100) / Pacientes Únicos Intervenidos",
                numerador: encefalopatiaCount,
                denominador: uniquePatientsCount,
                valor: parseFloat(tasaEncefalopatia.toFixed(2)),
                unidad: "%"
            },
            {
                id: 10,
                nombre: "Tasa de mortalidad de Centro Quirúrgico",
                formula: "(Total Fallecidos Qx/URPA * 100) / Pacientes Únicos Intervenidos",
                numerador: totalDeaths,
                denominador: uniquePatientsCount,
                valor: parseFloat(tasaMortalidad.toFixed(2)),
                unidad: "%"
            },
            {
                id: 11,
                nombre: "Tasa de pacientes reintervenidos",
                formula: "(Pacientes Reintervenidos * 100) / Pacientes Únicos Intervenidos",
                numerador: reintervenidosCount,
                denominador: uniquePatientsCount,
                valor: parseFloat(tasaReintervenidos.toFixed(2)),
                unidad: "%"
            },
            {
                id: 12,
                nombre: "Grado de cumplimiento de operaciones programadas",
                formula: "(Cirugías Electivas Ejecutadas * 100) / Total Programadas (Electivas)",
                numerador: cumplimientoNumerator,
                denominador: cumplimientoDenominator,
                valor: parseFloat(gradoCumplimiento.toFixed(2)),
                unidad: "%"
            },
            {
                id: 13,
                nombre: "Número de pacientes que ingresan a sala de recuperación post anestésica (URPA)",
                formula: "Conteo de Cirugías con Salida de URPA",
                numerador: pacientesIngresanUrpa,
                denominador: 1,
                valor: pacientesIngresanUrpa,
                unidad: "pacientes"
            },
            {
                id: 14,
                nombre: "Porcentaje de complicaciones en URPA",
                formula: "(Pacientes con Complicaciones URPA * 100) / Total Intervenciones Ejecutadas",
                numerador: complicacionesUrpaCount,
                denominador: totalExecuted,
                valor: parseFloat(porcComplicacionesUrpa.toFixed(2)),
                unidad: "%"
            },
            {
                id: 15,
                nombre: "Porcentaje de permanencia en URPA (Ocupación URPA)",
                formula: "(Horas Stay URPA * 100) / (2 camas * 24h * días del mes)",
                numerador: parseFloat(permanenciaUrpaHoras.toFixed(2)),
                denominador: disponibleUrpaHoras,
                valor: parseFloat(porcPermanenciaUrpa.toFixed(2)),
                unidad: "%"
            }
        ]
    };
}


