"use server";

import { db } from "@/db";
import {
  usersTable,
  staffProfiles,
  cqAccountRequests,
  cqSurgeries,
  cqSurgeryTeam,
  cqPatientPii,
  cqOperatingRooms,
  professions
} from "@/db/schema";
import { eq, and, sql, gte, lte, desc, inArray } from "drizzle-orm";

// ----------------------------------------------------
// HELPER: PII MASKING FUNCTION (LEY 29733 / MINSA)
// ----------------------------------------------------
export async function getMaskedPatientPii(
  patientPii: any,
  surgeryDateStr: string,
  isSpecialUser: boolean = false
) {
  if (!patientPii) return null;

  const rawName = (patientPii.nombres || patientPii.name || "").trim();
  const rawLastname = (patientPii.apellidos || patientPii.lastname || "").trim();
  const rawHc = (patientPii.historiaClinica || patientPii.hcNumber || "").trim();

  // 1. If special user (e.g. Jhony Vela 09791569 / Admins): ALWAYS unmasked
  if (isSpecialUser) {
    return {
      dni: patientPii.dni || "",
      name: `${rawName} ${rawLastname}`.trim(),
      hcNumber: rawHc ? `HC: ${rawHc}` : "",
      bloodGroupRh: patientPii.bloodGroupRh || "",
      isMasked: false,
    };
  }

  // 2. Check if surgeryDate is TODAY in America/Lima timezone
  const todayLimaStr = new Date().toLocaleString("sv-SE", { timeZone: "America/Lima" }).split(' ')[0];
  
  let surgeryDateSimple = "";
  if (surgeryDateStr) {
    surgeryDateSimple = surgeryDateStr.split('T')[0];
  }

  const isToday = surgeryDateSimple === todayLimaStr;

  // 3. If TODAY: Unmasked for active shift workflow
  if (isToday) {
    return {
      dni: patientPii.dni || "",
      name: `${rawName} ${rawLastname}`.trim(),
      hcNumber: rawHc ? `HC: ${rawHc}` : "",
      bloodGroupRh: patientPii.bloodGroupRh || "",
      isMasked: false,
    };
  }

  // 4. If PAST or FUTURE date (not today): Mask PII for privacy compliance
  const getInitials = (str: string) => {
    if (!str) return "";
    return str
      .split(/\s+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + ".")
      .join(" ");
  };

  const maskedInitials = `${getInitials(rawName)} ${getInitials(rawLastname)}`.trim() || "PACIENTE RESTRINGIDO";
  
  let maskedHc = "HC: ****";
  if (rawHc && rawHc.length >= 3) {
    const lastDigits = rawHc.slice(-3);
    maskedHc = `HC: ****${lastDigits}`;
  }

  let maskedDni = "DNI: ****";
  if (patientPii.dni && patientPii.dni.length >= 4) {
    const firstTwo = patientPii.dni.slice(0, 2);
    const lastTwo = patientPii.dni.slice(-2);
    maskedDni = `${firstTwo}****${lastTwo}`;
  }

  return {
    dni: maskedDni,
    name: maskedInitials,
    lastname: "",
    hcNumber: maskedHc,
    bloodGroupRh: patientPii.bloodGroupRh || "",
    isMasked: true,
  };
}

// ----------------------------------------------------
// SERVER ACTION 1: FETCH USER SURGERY STATS
// ----------------------------------------------------
export async function getUserSurgeryStatsAction(userId: string) {
  try {
    if (!userId) {
      return { success: false, message: "ID de usuario no proporcionado." };
    }

    // Query all surgery team entries for this user
    const teamEntries = await db.select({
      surgeryId: cqSurgeryTeam.surgeryId,
      roleInSurgery: cqSurgeryTeam.roleInSurgery,
    })
    .from(cqSurgeryTeam)
    .where(eq(cqSurgeryTeam.staffUserId, userId));

    if (teamEntries.length === 0) {
      return {
        success: true,
        stats: {
          totalSurgeries: 0,
          completedSurgeries: 0,
          scheduledSurgeries: 0,
          cancelledSurgeries: 0,
          effectivenessRate: 0,
          rolesBreakdown: {},
          urgencyBreakdown: { emergencia: 0, electivo: 0 },
          typeBreakdown: { mayor: 0, menor: 0 },
        }
      };
    }

    const surgeryIds = Array.from(new Set(teamEntries.map(t => t.surgeryId)));

    // Fetch surgery records
    const surgeries = await db.select()
      .from(cqSurgeries)
      .where(inArray(cqSurgeries.id, surgeryIds));

    let completedSurgeries = 0;
    let scheduledSurgeries = 0;
    let cancelledSurgeries = 0;
    let emergenciaCount = 0;
    let electivoCount = 0;
    let mayorCount = 0;
    let menorCount = 0;

    surgeries.forEach(s => {
      if (s.status === 'completed') completedSurgeries++;
      else if (s.status === 'cancelled') cancelledSurgeries++;
      else scheduledSurgeries++;

      if (s.urgencyType?.toUpperCase() === 'EMERGENCIA') emergenciaCount++;
      else electivoCount++;

      if (s.surgeryType?.toLowerCase().includes('mayor')) mayorCount++;
      else menorCount++;
    });

    const totalSurgeries = surgeries.length;
    const activeOrCompleted = totalSurgeries - cancelledSurgeries;
    const effectivenessRate = activeOrCompleted > 0 
      ? Math.round((completedSurgeries / activeOrCompleted) * 100) 
      : 0;

    // Roles Breakdown
    const rolesBreakdown: Record<string, number> = {};
    teamEntries.forEach(t => {
      const r = t.roleInSurgery || "ASISTENCIAL";
      rolesBreakdown[r] = (rolesBreakdown[r] || 0) + 1;
    });

    return {
      success: true,
      stats: {
        totalSurgeries,
        completedSurgeries,
        scheduledSurgeries,
        cancelledSurgeries,
        effectivenessRate,
        rolesBreakdown,
        urgencyBreakdown: { emergencia: emergenciaCount, electivo: electivoCount },
        typeBreakdown: { mayor: mayorCount, menor: menorCount },
      }
    };
  } catch (error) {
    console.error("Error en getUserSurgeryStatsAction:", error);
    return { success: false, message: "Error al calcular estadísticas quirúrgicas." };
  }
}

// ----------------------------------------------------
// SERVER ACTION 2: FETCH USER SURGERY HISTORY (WITH PII PROTECTION)
// ----------------------------------------------------
export async function getUserSurgeryHistoryAction(userId: string) {
  try {
    if (!userId) {
      return { success: false, message: "ID de usuario no proporcionado." };
    }

    // Check if current user is special / admin (e.g. Jhony Vela)
    const userObj = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId)
    });

    const isSpecialUser = userObj?.email === "jhonyvp2000@gmail.com" || userObj?.dni === "09791569";

    // Query surgeries where user is team member
    const teamEntries = await db.select({
      surgeryId: cqSurgeryTeam.surgeryId,
      roleInSurgery: cqSurgeryTeam.roleInSurgery,
    })
    .from(cqSurgeryTeam)
    .where(eq(cqSurgeryTeam.staffUserId, userId));

    if (teamEntries.length === 0) {
      return { success: true, history: [] };
    }

    const roleMap = new Map<string, string>();
    teamEntries.forEach(t => {
      roleMap.set(t.surgeryId, t.roleInSurgery || "ASISTENCIAL");
    });

    const surgeryIds = Array.from(roleMap.keys());

    // Fetch detailed surgeries with patient PII and operating room
    const surgeries = await db.select({
      surgery: cqSurgeries,
      patientPii: cqPatientPii,
      roomName: cqOperatingRooms.name,
    })
    .from(cqSurgeries)
    .leftJoin(cqPatientPii, eq(cqSurgeries.patientId, cqPatientPii.patientId))
    .leftJoin(cqOperatingRooms, eq(cqSurgeries.operatingRoomId, cqOperatingRooms.id))
    .where(inArray(cqSurgeries.id, surgeryIds))
    .orderBy(desc(cqSurgeries.scheduledDate));

    const history = await Promise.all(surgeries.map(async item => {
      const surgeryDateStr = item.surgery.scheduledDate ? item.surgery.scheduledDate.toISOString() : "";
      const maskedPatient = await getMaskedPatientPii(item.patientPii, surgeryDateStr, isSpecialUser);

      return {
        id: item.surgery.id,
        surgeryDate: item.surgery.scheduledDate,
        surgeryDateStr: surgeryDateStr,
        status: item.surgery.status,
        surgeryType: item.surgery.surgeryType || "Cirugía Mayor",
        urgencyType: item.surgery.urgencyType || "ELECTIVO",
        diagnosis: item.surgery.diagnosis || "Sin diagnóstico especificado",
        procedure: item.surgery.notes || item.surgery.origin || "Intervención Programada",
        roomName: item.roomName || "Sala no asignada",
        roleInSurgery: roleMap.get(item.surgery.id) || "ASISTENCIAL",
        patient: maskedPatient,
      };
    }));

    return { success: true, history };
  } catch (error) {
    console.error("Error en getUserSurgeryHistoryAction:", error);
    return { success: false, message: "Error al obtener historial quirúrgico." };
  }
}
