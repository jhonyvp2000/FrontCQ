"use server";

import { db } from "@/db";
import { cqSurgeries, cqOperatingRooms, cqPatients, cqPatientPii, cqSpecialties, cqSurgeryTeam, usersTable, cqDiagnoses, cqSurgeryDiagnoses, cqSurgeryPostDiagnoses, cqProcedures, cqSurgeryProcedures, cqInterventionTypes, cqSurgeryInterventions, cqUbigeo } from "@/db/schema";
import { eq, desc, asc, and, gte, lte, ne, inArray, or, ilike } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getActiveDiagnoses() {
    return await db.select().from(cqDiagnoses).where(eq(cqDiagnoses.isActive, true)).orderBy(asc(cqDiagnoses.name)).limit(50);
}

export async function getActiveProcedures() {
    return await db.select().from(cqProcedures).where(eq(cqProcedures.isActive, true)).orderBy(asc(cqProcedures.name)).limit(50);
}

export async function getContextualCatalogs(surgeries: any[]) {
    const usedDxIds = new Set<string>();
    const usedProcIds = new Set<string>();
    
    surgeries.forEach(s => {
        if (s.diagnoses && Array.isArray(s.diagnoses)) {
            s.diagnoses.forEach((id: string) => usedDxIds.add(id));
        }
        if (s.postDiagnoses && Array.isArray(s.postDiagnoses)) {
            s.postDiagnoses.forEach((id: string) => usedDxIds.add(id));
        }
        if (s.procedures && Array.isArray(s.procedures)) {
            s.procedures.forEach((id: string) => usedProcIds.add(id));
        }
    });

    const usedDxIdsArr = Array.from(usedDxIds).filter(Boolean);
    const usedProcIdsArr = Array.from(usedProcIds).filter(Boolean);

    const specificDiagnoses = usedDxIdsArr.length > 0 
        ? await db.select().from(cqDiagnoses).where(inArray(cqDiagnoses.id, usedDxIdsArr)) 
        : [];
        
    const specificProcedures = usedProcIdsArr.length > 0 
        ? await db.select().from(cqProcedures).where(inArray(cqProcedures.id, usedProcIdsArr)) 
        : [];

    const defaultDiagnoses = await getActiveDiagnoses();
    const defaultProcedures = await getActiveProcedures();

    const mergedDiagnosesMap = new Map<string, any>();
    defaultDiagnoses.forEach(d => mergedDiagnosesMap.set(d.id, d));
    specificDiagnoses.forEach(d => mergedDiagnosesMap.set(d.id, d));
    const diagnoses = Array.from(mergedDiagnosesMap.values());

    const mergedProceduresMap = new Map<string, any>();
    defaultProcedures.forEach(p => mergedProceduresMap.set(p.id, p));
    specificProcedures.forEach(p => mergedProceduresMap.set(p.id, p));
    const procedures = Array.from(mergedProceduresMap.values());

    return {
        diagnoses,
        procedures
    };
}

export async function getActiveInterventions() {
    return await db.select().from(cqInterventionTypes).where(eq(cqInterventionTypes.isActive, true)).orderBy(asc(cqInterventionTypes.name));
}

export async function createCustomDiagnosis(name: string) {
    const code = `D-TMP-${Math.floor(Math.random() * 10000)}`;
    const [inserted] = await db.insert(cqDiagnoses).values({
        code,
        name: name.trim().toUpperCase(),
        isActive: true,
        isVerifiedMinsa: false,
    }).returning();
    return inserted;
}

export async function createCustomProcedure(name: string) {
    const code = `P-TMP-${Math.floor(Math.random() * 10000)}`;
    const [inserted] = await db.insert(cqProcedures).values({
        code,
        name: name.trim().toUpperCase(),
        isActive: true,
        isVerifiedMinsa: false,
    }).returning();
    return inserted;
}

export async function createCustomIntervention(name: string) {
    const code = `I-TMP-${Math.floor(Math.random() * 10000)}`;
    const [inserted] = await db.insert(cqInterventionTypes).values({
        code,
        name: name.trim().toUpperCase(),
        isActive: true,
    }).returning();
    return inserted;
}

export async function lookupProcedureInApi(query: string) {
    if (!query) return [];
    
    let resolvedList = [];
    const apiUrl = process.env.API_NETHOS_URL;
    let apiFailed = false;

    if (apiUrl) {
        try {
            console.log(`[lookupProcedure] Buscando: ${query} en ApiNetHos`);
            const res = await fetch(`${apiUrl}/api/procedimientos/search?query=${query}`, { cache: 'no-store' });
            
            if (res.ok) {
                const data = await res.json();
                
                if (data && data.success && Array.isArray(data.data) && data.data.length > 0) {
                    for (const proc of data.data) {
                        if (!proc) continue;
                        
                        const resolvedCode = String(proc.codigo || proc.code || proc.id_procedimiento || query).trim().substring(0, 20);
                        const resolvedName = String(proc.descripcion || proc.nombre || proc.name || "PROCEDIMIENTO ENCONTRADO").trim().toUpperCase();

                        const existing = await db.select().from(cqProcedures).where(eq(cqProcedures.code, resolvedCode)).limit(1);
                        
                        if (existing.length > 0 && existing[0]) {
                            resolvedList.push(existing[0]);
                        } else {
                            // Defer insertion by using a synthetic ID
                            resolvedList.push({
                                id: `__api_proc__${resolvedCode}|||${resolvedName}`,
                                code: resolvedCode,
                                name: resolvedName,
                                isActive: true,
                                isVerifiedMinsa: true,
                            });
                        }
                    }
                }
            } else {
                console.warn(`[lookupProcedure] ApiNetHos fallÃƒÂ³ con status ${res.status}`);
                apiFailed = true;
            }
        } catch (error) {
            console.error("[lookupProcedure] API fetch o DB Exception:", error);
            apiFailed = true;
        }
    } else {
        apiFailed = true;
    }

    if (apiFailed || resolvedList.length === 0) {
        console.log(`[lookupProcedure] Fallback Local Search para: ${query}`);
        const localMatches = await db.select().from(cqProcedures)
            .where(or(ilike(cqProcedures.code, `%${query}%`), ilike(cqProcedures.name, `%${query}%`))).limit(20);
        if (localMatches.length > 0) {
            resolvedList.push(...localMatches);
        }
    }

    if (apiFailed) {
        resolvedList.unshift({ __apiError: true });
    }

    return JSON.parse(JSON.stringify(resolvedList));
}

export async function lookupDiagnosisInApi(query: string) {
    if (!query) return [];
    
    let resolvedList = [];
    const apiUrl = process.env.API_NETHOS_URL;
    let apiFailed = false;

    if (apiUrl) {
        try {
            console.log(`[lookupDiagnosis] Buscando: ${query} en ApiNetHos`);
            const res = await fetch(`${apiUrl}/api/diagnosticos/search?query=${query}`, { cache: 'no-store' });
            
            if (res.ok) {
                const data = await res.json();
                
                if (data && data.success && Array.isArray(data.data) && data.data.length > 0) {
                    for (const dx of data.data) {
                        if (!dx) continue;
                        
                        const resolvedCode = String(dx.codigo || dx.code || dx.id_diagnostico || query).trim().substring(0, 20);
                        const resolvedName = String(dx.descripcion || dx.nombre || dx.name || "DIAGNÃƒâ€œSTICO ENCONTRADO").trim().toUpperCase();

                        const existing = await db.select().from(cqDiagnoses).where(eq(cqDiagnoses.code, resolvedCode)).limit(1);
                        
                        if (existing.length > 0 && existing[0]) {
                            resolvedList.push(existing[0]);
                        } else {
                            // Defer insertion by using a synthetic ID
                            resolvedList.push({
                                id: `__api_dx__${resolvedCode}|||${resolvedName}`,
                                code: resolvedCode,
                                name: resolvedName,
                                isActive: true,
                                isVerifiedMinsa: true,
                            });
                        }
                    }
                }
            } else {
                console.warn(`[lookupDiagnosis] ApiNetHos fallÃƒÂ³ con status ${res.status}`);
                apiFailed = true;
            }
        } catch (error) {
            console.error("[lookupDiagnosis] API fetch o DB Exception:", error);
            apiFailed = true;
        }
    } else {
        apiFailed = true;
    }

    if (apiFailed || resolvedList.length === 0) {
        console.log(`[lookupDiagnosis] Fallback Local Search para: ${query}`);
        const localMatches = await db.select().from(cqDiagnoses)
            .where(or(ilike(cqDiagnoses.code, `%${query}%`), ilike(cqDiagnoses.name, `%${query}%`))).limit(20);
        if (localMatches.length > 0) {
            resolvedList.push(...localMatches);
        }
    }

    if (apiFailed) {
        resolvedList.unshift({ __apiError: true });
    }

    return JSON.parse(JSON.stringify(resolvedList));
}

export async function getSurgeries(startDate?: Date, endDate?: Date) {
    let query = db.select({
        surgery: cqSurgeries,
        operatingRoom: cqOperatingRooms,
        patientPii: cqPatientPii,
        specialty: cqSpecialties,
    })
        .from(cqSurgeries)
        .leftJoin(cqOperatingRooms, eq(cqSurgeries.operatingRoomId, cqOperatingRooms.id))
        .leftJoin(cqPatientPii, eq(cqSurgeries.patientId, cqPatientPii.patientId))
        .leftJoin(cqSpecialties, eq(cqSurgeries.specialtyId, cqSpecialties.id))
        .orderBy(desc(cqSurgeries.scheduledDate));

    // If date filters requested, add them
    if (startDate && endDate) {
        // Need explicit where builder because leftJoin changes return type context lightly
        return await db.select({
            surgery: cqSurgeries,
            operatingRoom: cqOperatingRooms,
            patientPii: cqPatientPii,
            specialty: cqSpecialties,
        })
            .from(cqSurgeries)
            .leftJoin(cqOperatingRooms, eq(cqSurgeries.operatingRoomId, cqOperatingRooms.id))
            .leftJoin(cqPatientPii, eq(cqSurgeries.patientId, cqPatientPii.patientId))
            .leftJoin(cqSpecialties, eq(cqSurgeries.specialtyId, cqSpecialties.id))
            .where(
                and(
                    gte(cqSurgeries.scheduledDate, startDate),
                    lte(cqSurgeries.scheduledDate, endDate)
                )
            )
            .orderBy(desc(cqSurgeries.scheduledDate));
    }

    return await query;
}

export async function getSurgeriesByDateDesc(sortDir: 'asc' | 'desc' = 'desc', startDateFilter?: string, endDateFilter?: string) {
    const orderFn = sortDir === 'asc' ? asc : desc;
    
    let baseQuery = db.select({
        surgery: cqSurgeries,
        operatingRoom: cqOperatingRooms,
        patientPii: cqPatientPii,
        patient: cqPatients,
        ubigeo: cqUbigeo,
        specialty: cqSpecialties,
    })
        .from(cqSurgeries)
        .leftJoin(cqOperatingRooms, eq(cqSurgeries.operatingRoomId, cqOperatingRooms.id))
        .leftJoin(cqPatientPii, eq(cqSurgeries.patientId, cqPatientPii.patientId))
        .leftJoin(cqPatients, eq(cqSurgeries.patientId, cqPatients.id))
        .leftJoin(cqUbigeo, eq(cqPatients.ubigeo, cqUbigeo.code))
        .leftJoin(cqSpecialties, eq(cqSurgeries.specialtyId, cqSpecialties.id));

    let whereClause = undefined;

    if (endDateFilter) {
        if (startDateFilter) {
            // Regla 1: Rango [startDateFilter, endDateFilter]
            const start = new Date(`${startDateFilter}T00:00:00`);
            const end = new Date(`${endDateFilter}T23:59:59.999`);
            whereClause = and(gte(cqSurgeries.scheduledDate, start), lte(cqSurgeries.scheduledDate, end));
        } else {
            // Regla 2: Día puntual [endDateFilter, endDateFilter]
            const start = new Date(`${endDateFilter}T00:00:00`);
            const end = new Date(`${endDateFilter}T23:59:59.999`);
            whereClause = and(gte(cqSurgeries.scheduledDate, start), lte(cqSurgeries.scheduledDate, end));
        }
    } else {
        if (startDateFilter) {
            // Regla 6: Desde startDateFilter hasta hoy
            const start = new Date(`${startDateFilter}T00:00:00`);
            const todayStr = new Date().toLocaleString("sv-SE", { timeZone: "America/Lima" }).split(' ')[0];
            const end = new Date(`${todayStr}T23:59:59.999`);
            whereClause = and(gte(cqSurgeries.scheduledDate, start), lte(cqSurgeries.scheduledDate, end));
        } else {
            // Regla 6 (excepcional): Sin filtros
            whereClause = undefined;
        }
    }

    if (whereClause) {
        baseQuery = baseQuery.where(whereClause) as any;
    }

    const surgeries = await baseQuery.orderBy(orderFn(cqSurgeries.scheduledDate));

    if (surgeries.length === 0) return [];

    const surgeryIds = surgeries.map(s => s.surgery.id);

    const teams = await db.select({
        surgeryId: cqSurgeryTeam.surgeryId,
        role: cqSurgeryTeam.roleInSurgery,
        staff: {
            id: usersTable.id,
            name: usersTable.name,
            lastname: usersTable.lastname,
            dni: usersTable.dni,
        }
    })
        .from(cqSurgeryTeam)
        .innerJoin(usersTable, eq(cqSurgeryTeam.staffUserId, usersTable.id))
        .where(inArray(cqSurgeryTeam.surgeryId, surgeryIds));

    const diagRecords = await db.select({
        surgeryId: cqSurgeryDiagnoses.surgeryId,
        diagnosisId: cqSurgeryDiagnoses.diagnosisId
    }).from(cqSurgeryDiagnoses).where(inArray(cqSurgeryDiagnoses.surgeryId, surgeryIds));

    const postDiagRecords = await db.select({
        surgeryId: cqSurgeryPostDiagnoses.surgeryId,
        diagnosisId: cqSurgeryPostDiagnoses.diagnosisId
    }).from(cqSurgeryPostDiagnoses).where(inArray(cqSurgeryPostDiagnoses.surgeryId, surgeryIds));

    const procRecords = await db.select({
        surgeryId: cqSurgeryProcedures.surgeryId,
        procedureId: cqSurgeryProcedures.procedureId
    }).from(cqSurgeryProcedures).where(inArray(cqSurgeryProcedures.surgeryId, surgeryIds));

    const intRecords = await db.select({
        surgeryId: cqSurgeryInterventions.surgeryId,
        interventionId: cqSurgeryInterventions.interventionId
    }).from(cqSurgeryInterventions).where(inArray(cqSurgeryInterventions.surgeryId, surgeryIds));

    return surgeries.map(s => ({
        ...s,
        patientUbigeo: s.ubigeo ? {
            code: s.ubigeo.code,
            distrito: s.ubigeo.distrito,
            provincia: s.ubigeo.provincia,
            departamento: s.ubigeo.departamento
        } : null,
        team: teams.filter(t => t.surgeryId === s.surgery.id),
        diagnoses: diagRecords.filter(d => d.surgeryId === s.surgery.id).map(d => d.diagnosisId),
        postDiagnoses: postDiagRecords.filter(d => d.surgeryId === s.surgery.id).map(d => d.diagnosisId),
        procedures: procRecords.filter(p => p.surgeryId === s.surgery.id).map(p => p.procedureId),
        interventions: intRecords.filter(i => i.surgeryId === s.surgery.id).map(i => i.interventionId)
    }));
}

function getDurationMs(durationStr: string): number {
    switch (durationStr) {
        case "30 minutos": return 30 * 60000;
        case "1 hora": return 60 * 60000;
        case "2 horas": return 120 * 60000;
        case "3 horas": return 180 * 60000;
        case "4+ horas": return 240 * 60000;
        default: return 60 * 60000;
    }
}

export async function createSurgery(formData: FormData) {
    const patientIdRaw = formData.get("patient_id") as string;
    const patientId = patientIdRaw ? patientIdRaw.trim() : "";
    const operatingRoomId = formData.get("operating_room_id") as string | null;
    const scheduledDateStr = formData.get("scheduled_date") as string;
    const scheduledTimeStr = formData.get("scheduled_time") as string;
    const requestDateStr = formData.get("request_date") as string;
    const estimatedDuration = formData.get("estimated_duration") as string;
    const notes = formData.get("notes") as string;
    const diagnosesIds = formData.getAll("diagnoses") as string[];
    const postDiagnosesIds = formData.getAll("post_diagnoses") as string[];
    const proceduresIds = formData.getAll("procedures") as string[];
    const interventionsIds = formData.getAll("interventions") as string[];
    const surgeryType = formData.get("surgery_type") as string;
    const urgencyType = formData.get("urgency_type") as string;
    const insuranceType = formData.get("insurance_type") as string;
    const anesthesiaType = formData.get("anesthesia_type") as string;
    const origin = formData.get("origin") as string;
    const bedNumber = formData.get("bed_number") as string;
    const internalCode = formData.get("internal_code") as string;
    const specialtyId = formData.get("specialty_id") as string;
    const isFromCopri = formData.get("is_from_copri") === "on" || formData.get("is_from_copri") === "true";
    const isRescheduled = formData.get("is_rescheduled") === "on" || formData.get("is_rescheduled") === "true";
    const isReintervention = formData.get("is_reintervention") === "on" || formData.get("is_reintervention") === "true";
    const hasHypoxicEncephalopathy = formData.get("has_hypoxic_encephalopathy") === "on" || formData.get("has_hypoxic_encephalopathy") === "true";
    const hasUrpaComplication = formData.get("has_urpa_complication") === "on" || formData.get("has_urpa_complication") === "true";
    const diedInSurgery = formData.get("died_in_surgery") === "on" || formData.get("died_in_surgery") === "true";
    const diedInUrpa = formData.get("died_in_urpa") === "on" || formData.get("died_in_urpa") === "true";

    const surgeonIds = formData.getAll("surgeons") as string[];
    const anesthesiologistIds = formData.getAll("anesthesiologists") as string[];
    const instrumentistaIds = formData.getAll("instrumentistas") as string[];
    const circulanteIds = formData.getAll("circulantes") as string[];

    const isPorDefinir = patientId === "00000000" || patientId.toUpperCase() === "POR DEFINIR";
    let faltantes = [];
    if (!patientId) faltantes.push("Paciente");
    if (!scheduledDateStr) faltantes.push("Fecha Programada");
    if (!isPorDefinir && diagnosesIds.length === 0) faltantes.push("DiagnÃƒÂ³stico");
    if (!isPorDefinir && !surgeryType) faltantes.push("Tipo de CirugÃƒÂ­a");
    if (!isPorDefinir && !specialtyId) faltantes.push("Especialidad");

    if (faltantes.length > 0) {
        return { error: `Faltan campos obligatorios para agendar: ${faltantes.join(", ")}.` };
    }

    // Resolve deferred Synthetic IDs for Diagnoses (Late-bound DB Injection)
    const finalDiagnosisIds: string[] = [];
    for (const did of diagnosesIds) {
        if (did.startsWith('__api_dx__')) {
            const parts = did.replace('__api_dx__', '').split('|||');
            const code = parts[0];
            const name = parts.slice(1).join('|||');
            
            const existing = await db.select().from(cqDiagnoses).where(eq(cqDiagnoses.code, code)).limit(1);
            if (existing.length > 0) {
                finalDiagnosisIds.push(existing[0].id);
            } else {
                const [inserted] = await db.insert(cqDiagnoses).values({
                    code: code.substring(0, 20),
                    name: name,
                    isActive: true,
                    isVerifiedMinsa: true
                }).returning({ id: cqDiagnoses.id });
                if (inserted) finalDiagnosisIds.push(inserted.id);
            }
        } else {
            finalDiagnosisIds.push(did);
        }
    }

    // Resolve deferred Synthetic IDs for Procedures
    const finalProcedureIds: string[] = [];
    for (const pid of proceduresIds) {
        if (pid.startsWith('__api_proc__')) {
            const parts = pid.replace('__api_proc__', '').split('|||');
            const code = parts[0];
            const name = parts.slice(1).join('|||');
            
            const existing = await db.select().from(cqProcedures).where(eq(cqProcedures.code, code)).limit(1);
            if (existing.length > 0) {
                finalProcedureIds.push(existing[0].id);
            } else {
                const [inserted] = await db.insert(cqProcedures).values({
                    code: code.substring(0, 20),
                    name: name,
                    isActive: true,
                    isVerifiedMinsa: true
                }).returning({ id: cqProcedures.id });
                if (inserted) finalProcedureIds.push(inserted.id);
            }
        } else {
            finalProcedureIds.push(pid);
        }
    }

    const trueDiagnosesIds = [...new Set(finalDiagnosisIds)];
    const trueProceduresIds = [...new Set(finalProcedureIds)];

    // Resolve deferred Synthetic IDs for Post Diagnoses (Late-bound DB Injection)
    const finalPostDiagnosisIds: string[] = [];
    for (const did of postDiagnosesIds) {
        if (did.startsWith('__api_dx__')) {
            const parts = did.replace('__api_dx__', '').split('|||');
            const code = parts[0];
            const name = parts.slice(1).join('|||');
            
            const existing = await db.select().from(cqDiagnoses).where(eq(cqDiagnoses.code, code)).limit(1);
            if (existing.length > 0) {
                finalPostDiagnosisIds.push(existing[0].id);
            } else {
                const [inserted] = await db.insert(cqDiagnoses).values({
                    code: code.substring(0, 20),
                    name: name,
                    isActive: true,
                    isVerifiedMinsa: true
                }).returning({ id: cqDiagnoses.id });
                if (inserted) finalPostDiagnosisIds.push(inserted.id);
            }
        } else {
            finalPostDiagnosisIds.push(did);
        }
    }
    const truePostDiagnosesIds = [...new Set(finalPostDiagnosisIds)];

    // Resolve diagnosis details from True IDs to text for legacy/easy reading
    const selectedDiags = await db.select().from(cqDiagnoses).where(inArray(cqDiagnoses.id, trueDiagnosesIds));
    const diagnosis = selectedDiags.map(d => `${d.code} - ${d.name}`).join(", ");

    const selectedPostDiags = truePostDiagnosesIds.length > 0 ? await db.select().from(cqDiagnoses).where(inArray(cqDiagnoses.id, truePostDiagnosesIds)) : [];
    const postDiagnosis = selectedPostDiags.map(d => `${d.code} - ${d.name}`).join(", ");

    const finalUrgencyType = urgencyType || 'ELECTIVO';

    const roomId = operatingRoomId ? operatingRoomId : null;

    // Combine date and time
    const isTimeDefined = Boolean(scheduledTimeStr);
    const timeToStore = isTimeDefined ? scheduledTimeStr : "00:00";
    const scheduledDate = new Date(`${scheduledDateStr}T${timeToStore}:00`);

    if (roomId && isTimeDefined) {
        const newStartMs = scheduledDate.getTime();
        const newEndMs = newStartMs + getDurationMs(estimatedDuration);

        // Fetch active surgeries for this specific operating room
        const existingSurgeries = await db.select()
            .from(cqSurgeries)
            .where(
                and(
                    eq(cqSurgeries.operatingRoomId, roomId),
                    ne(cqSurgeries.status, 'cancelled'),
                    eq(cqSurgeries.isTimeDefined, true)
                )
            );

        for (const surgery of existingSurgeries) {
            // Date parsing directly from DB timestamp
            const existingStartMs = surgery.scheduledDate.getTime();
            const existingEndMs = existingStartMs + getDurationMs(surgery.estimatedDuration || "1 hora");

            // Validation formula: (StartA < EndB) and (EndA > StartB) means OVERLAP
            if (newStartMs < existingEndMs && newEndMs > existingStartMs) {
                const dateStr = surgery.scheduledDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const timeStr = surgery.scheduledDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
                return { error: `La sala seleccionada sufre un cruce de horarios.\n\nExiste una cirugÃƒÂ­a programada para el ${dateStr} a las ${timeStr} que durarÃƒÂ¡ aprox. ${surgery.estimatedDuration || "1 hora"}. Sus lapsos de ocupaciÃƒÂ³n se sobreponen.` };
            }
        }
    }

    // Identidad Disociada (Identity Vault Logic)
    let finalPatientId: string | null = null;
    const existingPii = await db.select().from(cqPatientPii).where(
        or(
            eq(cqPatientPii.dni, patientId),
            eq(cqPatientPii.historiaClinica, patientId),
            eq(cqPatientPii.carnetExtranjeria, patientId),
            eq(cqPatientPii.pasaporte, patientId)
        )
    ).limit(1);

    if (existingPii.length > 0) {
        finalPatientId = existingPii[0].patientId;

        // Update patient's address/ubigeo if apiData was sent
        const apiPatientDataRaw = formData.get("api_patient_data") as string | null;
        if (apiPatientDataRaw) {
            try {
                const parsed = JSON.parse(apiPatientDataRaw);
                const pUbigeo = parsed.ubigeo || null;
                const pDireccion = parsed.direccion || null;
                
                if (pUbigeo) {
                    await db.update(cqPatients).set({ ubigeo: pUbigeo }).where(eq(cqPatients.id, finalPatientId));
                }
                if (pDireccion) {
                    await db.update(cqPatientPii).set({ direccion: pDireccion }).where(eq(cqPatientPii.patientId, finalPatientId));
                }
            } catch (e) {
                console.error("Failed to update patient address/ubigeo from apiData in createSurgery", e);
            }
        }

        const bloodGroupRh = formData.get("blood_group_rh") as string | null;
        if (bloodGroupRh) {
            await db.update(cqPatientPii).set({ bloodGroupRh }).where(eq(cqPatientPii.patientId, finalPatientId));
        }
    } else {
        const apiPatientDataRaw = formData.get("api_patient_data") as string | null;
        let pName = 'NO IDENTIFICADO';
        let pLastName = 'NO IDENTIFICADO';
        let pSexo = null;
        let pFechaNac = null;
        let pUbigeo = null;
        let pHistoriaClinica = patientId;
        let pDireccion = null;

        if (apiPatientDataRaw) {
            try {
                const parsed = JSON.parse(apiPatientDataRaw);
                pName = parsed.nombres || pName;
                pLastName = parsed.apellidos || pLastName;
                pSexo = parsed.sexo || null;
                pFechaNac = parsed.fechaNacimiento ? new Date(parsed.fechaNacimiento) : null;
                pUbigeo = parsed.ubigeo || null;
                pHistoriaClinica = parsed.historiaClinica || pHistoriaClinica;
                pDireccion = parsed.direccion || null;
            } catch (e) {
                console.error("Failed to parse api_patient_data", e);
            }
        }

        try {
            // Demographics
            const [newPat] = await db.insert(cqPatients).values({
                sexo: pSexo,
                fechaNacimiento: pFechaNac,
                ubigeo: pUbigeo,
            }).returning({ id: cqPatients.id });
            
            finalPatientId = newPat.id;

            // Identity Vault
            const bloodGroupRh = formData.get("blood_group_rh") as string | null;
            await db.insert(cqPatientPii).values({
                patientId: finalPatientId,
                dni: patientId,
                nombres: pName,
                apellidos: pLastName,
                historiaClinica: pHistoriaClinica,
                direccion: pDireccion,
                bloodGroupRh
            });
        } catch (dbErr) {
            // Fallback total: si algo fallÃƒÂ³ en la inserciÃƒÂ³n (carrera de procesos), buscamos de nuevo
            const lastHope = await db.select().from(cqPatientPii).where(
                or(
                    eq(cqPatientPii.dni, patientId),
                    eq(cqPatientPii.historiaClinica, patientId)
                )
            ).limit(1);
            if (lastHope.length > 0) {
                finalPatientId = lastHope[0].patientId;
            } else {
                return { error: `No se pudo registrar el paciente (posible error FK o restricción). Detalle técnico: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}` };
            }
        }
    }

    if (!finalPatientId) {
        return { error: "Error crÃƒÂ­tico: No se pudo resolver la identidad del paciente." };
    }

    const newSurgery = await db.insert(cqSurgeries).values({
        patientId: finalPatientId,
        operatingRoomId: roomId,
        requestDate: requestDateStr || new Date().toISOString().split('T')[0],
        scheduledDate,
        isTimeDefined,
        status: 'scheduled',
        estimatedDuration,
        diagnosis,
        postDiagnosis,
        surgeryType,
        urgencyType: finalUrgencyType,
        insuranceType,
        anesthesiaType,
        origin,
        bedNumber: bedNumber || null,
        internalCode: internalCode || null,
        specialtyId: specialtyId || null,
        notes,
        isFromCopri,
        isRescheduled,
        isReintervention,
        hasHypoxicEncephalopathy,
        hasUrpaComplication,
        diedInSurgery,
        diedInUrpa,
    }).returning({ id: cqSurgeries.id });

    const surgeryRecordId = newSurgery[0].id;

    const teamInserts: any[] = [];

    for (const sid of surgeonIds) {
        teamInserts.push({ surgeryId: surgeryRecordId, staffUserId: sid, roleInSurgery: 'CIRUJANO' });
    }
    for (const aid of anesthesiologistIds) {
        teamInserts.push({ surgeryId: surgeryRecordId, staffUserId: aid, roleInSurgery: 'ANESTESIOLOGO' });
    }
    for (const nid of instrumentistaIds) {
        teamInserts.push({ surgeryId: surgeryRecordId, staffUserId: nid, roleInSurgery: 'INSTRUMENTISTA' });
    }
    for (const nid of circulanteIds) {
        teamInserts.push({ surgeryId: surgeryRecordId, staffUserId: nid, roleInSurgery: 'CIRCULANTE' });
    }

    if (teamInserts.length > 0) {
        await db.insert(cqSurgeryTeam).values(teamInserts);
    }

    const diagInserts = trueDiagnosesIds.map(did => ({ surgeryId: surgeryRecordId, diagnosisId: did }));
    if (diagInserts.length > 0) {
        await db.insert(cqSurgeryDiagnoses).values(diagInserts).onConflictDoNothing();
    }

    const postDiagInserts = truePostDiagnosesIds.map(did => ({ surgeryId: surgeryRecordId, diagnosisId: did }));
    if (postDiagInserts.length > 0) {
        await db.insert(cqSurgeryPostDiagnoses).values(postDiagInserts).onConflictDoNothing();
    }

    const procInserts = trueProceduresIds.map(pid => ({ surgeryId: surgeryRecordId, procedureId: pid }));
    if (procInserts.length > 0) {
        await db.insert(cqSurgeryProcedures).values(procInserts).onConflictDoNothing();
    }

    const interInserts = interventionsIds.map(iid => ({ surgeryId: surgeryRecordId, interventionId: iid }));
    if (interInserts.length > 0) {
        await db.insert(cqSurgeryInterventions).values(interInserts).onConflictDoNothing();
    }

    revalidatePath("/dashboard/programaciones");
    revalidatePath("/dashboard/pacientes");
    revalidatePath("/dashboard", "layout");

    return { success: true, surgeryId: surgeryRecordId };
}

export async function updateSurgeryStatus(formData: FormData) {
    const id = formData.get("id") as string;
    const status = formData.get("status") as string; // scheduled, in_progress, completed, cancelled

    if (!id || !status) throw new Error("Missing identification or payload");

    const surgeryRow = await db.select().from(cqSurgeries).where(eq(cqSurgeries.id, id)).limit(1);
    if (surgeryRow.length === 0) return { error: "CirugÃƒÂ­a no encontrada" };
    const targetSurgery = surgeryRow[0];

    if (status === 'scheduled') {
        if (targetSurgery.operatingRoomId) {
            const existingSurgeries = await db.select()
                .from(cqSurgeries)
                .where(
                    and(
                        eq(cqSurgeries.operatingRoomId, targetSurgery.operatingRoomId),
                        ne(cqSurgeries.id, id),
                        ne(cqSurgeries.status, 'cancelled')
                    )
                );

            const newStartMs = targetSurgery.scheduledDate.getTime();
            const newEndMs = newStartMs + getDurationMs(targetSurgery.estimatedDuration || "1 hora");

            for (const existing of existingSurgeries) {
                const existingStartMs = existing.scheduledDate.getTime();
                const existingEndMs = existingStartMs + getDurationMs(existing.estimatedDuration || "1 hora");

                if (newStartMs < existingEndMs && newEndMs > existingStartMs) {
                    const dateStr = existing.scheduledDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const timeStr = existing.scheduledDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
                    return { error: `No es posible reactivar la cirugÃƒÂ­a: La sala asignada estÃƒÂ¡ actualmente ocupada por otra cirugÃƒÂ­a programada para el ${dateStr} a las ${timeStr}.` };
                }
            }
        }
    }

    const transitionTimeStr = formData.get("transition_time") as string;

    let updatePayload: any = {
        status,
        updatedAt: new Date(),
    };

    if (status === 'cancelled') {
        const cancellationReason = formData.get("cancellation_reason") as string | null;
        updatePayload.cancellationReason = cancellationReason ? cancellationReason.trim() : null;
    }

    if (transitionTimeStr) {
        const transitionDate = new Date(transitionTimeStr);
        const tdMs = transitionDate.getTime();

        switch (status) {
            case 'in_progress':
                updatePayload.actualStartTime = transitionDate;
                break;
            case 'anesthesia_start':
                if (targetSurgery.actualStartTime && tdMs < targetSurgery.actualStartTime.getTime()) {
                    return { error: "Error de consistencia temporal:\n\nEl 'Inicio de Anestesia' debe ser igual o posterior al tiempo de 'Ingreso a QuirÃƒÂ³fano'." };
                }
                updatePayload.anesthesiaStartTime = transitionDate;
                break;
            case 'pre_incision':
                if (targetSurgery.anesthesiaStartTime && tdMs < targetSurgery.anesthesiaStartTime.getTime()) {
                    return { error: "Error de consistencia temporal:\n\nEl tiempo 'Antes de IncisiÃƒÂ³n' debe ser igual o posterior al tiempo de 'Inicio de Anestesia'." };
                }
                updatePayload.preIncisionTime = transitionDate;
                break;
            case 'surgery_end':
                if (targetSurgery.preIncisionTime && tdMs < targetSurgery.preIncisionTime.getTime()) {
                    return { error: "Error de consistencia temporal:\n\nEl 'TÃƒÂ©rmino de CirugÃƒÂ­a' debe ser igual o posterior al tiempo 'Antes de IncisiÃƒÂ³n'." };
                }
                updatePayload.surgeryEndTime = transitionDate;
                break;
            case 'patient_exit':
                if (targetSurgery.surgeryEndTime && tdMs < targetSurgery.surgeryEndTime.getTime()) {
                    return { error: "Error de consistencia temporal:\n\nLa 'Salida del Paciente' debe ser igual o posterior al tiempo de 'TÃƒÂ©rmino de CirugÃƒÂ­a'." };
                }
                updatePayload.patientExitTime = transitionDate;
                break;
            case 'urpa_exit':
                if (targetSurgery.patientExitTime && tdMs < targetSurgery.patientExitTime.getTime()) {
                    return { error: "Error de consistencia temporal:\n\nLa 'Salida de URPA' debe ser igual o posterior a la 'Salida del Paciente'." };
                }
                updatePayload.urpaExitTime = transitionDate;
                break;
            case 'completed':
                if (targetSurgery.urpaExitTime && tdMs < targetSurgery.urpaExitTime.getTime()) {
                    return { error: "Error de consistencia temporal:\n\nLa 'FinalizaciÃƒÂ³n' debe ser igual o posterior a la 'Salida de URPA'." };
                } else if (!targetSurgery.urpaExitTime && targetSurgery.patientExitTime && tdMs < targetSurgery.patientExitTime.getTime()) {
                    return { error: "Error de consistencia temporal:\n\nLa 'FinalizaciÃƒÂ³n' debe ser igual o posterior a la 'Salida del Paciente'." };
                }
                updatePayload.completedTime = transitionDate;
                
                // Capturar fallecimiento si se envÃƒÂ­a en el form
                const isDeath = formData.get("isDeathByEmergency") === "true";
                updatePayload.isDeathByEmergency = isDeath;
                break;
        }
    }

    if (formData.has("isReintervention")) {
        updatePayload.isReintervention = formData.get("isReintervention") === "true" || formData.get("isReintervention") === "on";
    }
    if (formData.has("hasHypoxicEncephalopathy")) {
        updatePayload.hasHypoxicEncephalopathy = formData.get("hasHypoxicEncephalopathy") === "true" || formData.get("hasHypoxicEncephalopathy") === "on";
    }
    if (formData.has("hasUrpaComplication")) {
        updatePayload.hasUrpaComplication = formData.get("hasUrpaComplication") === "true" || formData.get("hasUrpaComplication") === "on";
    }
    if (formData.has("diedInSurgery")) {
        updatePayload.diedInSurgery = formData.get("diedInSurgery") === "true" || formData.get("diedInSurgery") === "on";
    }
    if (formData.has("diedInUrpa")) {
        updatePayload.diedInUrpa = formData.get("diedInUrpa") === "true" || formData.get("diedInUrpa") === "on";
    }

    await db.update(cqSurgeries).set(updatePayload).where(eq(cqSurgeries.id, id));
    const updated = await db.select().from(cqSurgeries).where(eq(cqSurgeries.id, id)).limit(1);

    revalidatePath("/dashboard/programaciones");
    revalidatePath("/dashboard/pacientes");
    return { success: true, surgery: updated[0] };
}

export async function deleteSurgery(formData: FormData) {
    const id = formData.get("id") as string;

    if (!id) return { error: "ID de cirugÃƒÂ­a obligatorio para eliminar" };

    try {
        const { cqSurgicalReports } = await import("@/db/schema");
        const targetSurgery = await db.select().from(cqSurgeries).where(eq(cqSurgeries.id, id)).limit(1);

        if (targetSurgery.length === 0) {
            return { error: "No se encontrÃƒÂ³ el registro especificado." };
        }

        if (targetSurgery[0].status === 'completed') {
            return { error: "Prohibido: Esta cirugÃƒÂ­a ya ha sido completada. No puede eliminarse, solo auditarse en el historial." };
        }

        const associated = await db.select().from(cqSurgicalReports).where(eq(cqSurgicalReports.surgeryId, id)).limit(1);

        if (associated.length > 0) {
            return { error: "No se puede eliminar la ProgramaciÃƒÂ³n QuirÃƒÂºrgica: Ya cuenta con un Reporte Operatorio firmado en el historial legal." };
        }

        await db.delete(cqSurgeries).where(eq(cqSurgeries.id, id));
        revalidatePath("/dashboard/programaciones");
    revalidatePath("/dashboard/pacientes");
    } catch (error: any) {
        return { error: "OcurriÃƒÂ³ un error inesperado al intentar borrar el registro de programaciÃƒÂ³n." };
    }
}

export async function editSurgery(formData: FormData) {
    const id = formData.get("id") as string;
    const patientIdRaw = formData.get("patient_id") as string;
    const patientId = patientIdRaw ? patientIdRaw.trim() : "";
    const isPorDefinir = patientId === "00000000" || patientId.toUpperCase() === "POR DEFINIR";
    const operatingRoomId = formData.get("operating_room_id") as string | null;
    const scheduledDateStr = formData.get("scheduled_date") as string;
    const scheduledTimeStr = formData.get("scheduled_time") as string;
    const requestDateStr = formData.get("request_date") as string;
    const estimatedDuration = formData.get("estimated_duration") as string;
    const notes = formData.get("notes") as string;
    const surgeryType = formData.get("surgery_type") as string;
    const urgencyType = formData.get("urgency_type") as string;
    const insuranceType = formData.get("insurance_type") as string;
    const origin = formData.get("origin") as string;
    const bedNumber = formData.get("bed_number") as string;
    const internalCode = formData.get("internal_code") as string;
    const specialtyId = formData.get("specialty_id") as string;
    const isFromCopri = formData.get("is_from_copri") === "on" || formData.get("is_from_copri") === "true";
    const isRescheduled = formData.get("is_rescheduled") === "on" || formData.get("is_rescheduled") === "true";
    const isReintervention = formData.get("is_reintervention") === "on" || formData.get("is_reintervention") === "true";
    const hasHypoxicEncephalopathy = formData.get("has_hypoxic_encephalopathy") === "on" || formData.get("has_hypoxic_encephalopathy") === "true";
    const hasUrpaComplication = formData.get("has_urpa_complication") === "on" || formData.get("has_urpa_complication") === "true";
    const diedInSurgery = formData.get("died_in_surgery") === "on" || formData.get("died_in_surgery") === "true";
    const diedInUrpa = formData.get("died_in_urpa") === "on" || formData.get("died_in_urpa") === "true";
    const anesthesiaType = formData.get("anesthesia_type") as string;

    const surgeonIds = formData.getAll("surgeons") as string[];
    const anesthesiologistIds = formData.getAll("anesthesiologists") as string[];
    const instrumentistaIds = formData.getAll("instrumentistas") as string[];
    const circulanteIds = formData.getAll("circulantes") as string[];
    const diagnosesIds = formData.getAll("diagnoses") as string[];
    const postDiagnosesIds = formData.getAll("post_diagnoses") as string[];
    const proceduresIds = formData.getAll("procedures") as string[];
    const interventionsIds = formData.getAll("interventions") as string[];

    if (!id) return { error: "ID de cirugÃƒÂ­a no proporcionado." };
    let faltantes = [];
    if (!patientId) faltantes.push("Paciente");
    if (!scheduledDateStr) faltantes.push("Fecha Programada");
    if (!isPorDefinir && diagnosesIds.length === 0) faltantes.push("DiagnÃƒÂ³stico");
    if (!isPorDefinir && !surgeryType) faltantes.push("Tipo de CirugÃƒÂ­a");
    if (!isPorDefinir && !specialtyId) faltantes.push("Especialidad");
    if (!isPorDefinir && !requestDateStr) faltantes.push("Fecha Solicitud");

    if (faltantes.length > 0) {
        return { error: `Faltan campos obligatorios para agendar: ${faltantes.join(", ")}.` };
    }

    // Resolve deferred Synthetic IDs for Diagnoses (Late-bound DB Injection)
    const finalDiagnosisIds: string[] = [];
    for (const did of diagnosesIds) {
        if (did.startsWith('__api_dx__')) {
            const parts = did.replace('__api_dx__', '').split('|||');
            const code = parts[0];
            const name = parts.slice(1).join('|||');
            
            const existing = await db.select().from(cqDiagnoses).where(eq(cqDiagnoses.code, code)).limit(1);
            if (existing.length > 0) {
                finalDiagnosisIds.push(existing[0].id);
            } else {
                const [inserted] = await db.insert(cqDiagnoses).values({
                    code: code.substring(0, 20),
                    name: name,
                    isActive: true,
                    isVerifiedMinsa: true
                }).returning({ id: cqDiagnoses.id });
                if (inserted) finalDiagnosisIds.push(inserted.id);
            }
        } else {
            finalDiagnosisIds.push(did);
        }
    }

    // Resolve deferred Synthetic IDs for Procedures
    const finalProcedureIds: string[] = [];
    for (const pid of proceduresIds) {
        if (pid.startsWith('__api_proc__')) {
            const parts = pid.replace('__api_proc__', '').split('|||');
            const code = parts[0];
            const name = parts.slice(1).join('|||');
            
            const existing = await db.select().from(cqProcedures).where(eq(cqProcedures.code, code)).limit(1);
            if (existing.length > 0) {
                finalProcedureIds.push(existing[0].id);
            } else {
                const [inserted] = await db.insert(cqProcedures).values({
                    code: code.substring(0, 20),
                    name: name,
                    isActive: true,
                    isVerifiedMinsa: true
                }).returning({ id: cqProcedures.id });
                if (inserted) finalProcedureIds.push(inserted.id);
            }
        } else {
            finalProcedureIds.push(pid);
        }
    }

    const trueDiagnosesIds = [...new Set(finalDiagnosisIds)];
    const trueProceduresIds = [...new Set(finalProcedureIds)];

    // Resolve deferred Synthetic IDs for Post Diagnoses (Late-bound DB Injection)
    const finalPostDiagnosisIds: string[] = [];
    for (const did of postDiagnosesIds) {
        if (did.startsWith('__api_dx__')) {
            const parts = did.replace('__api_dx__', '').split('|||');
            const code = parts[0];
            const name = parts.slice(1).join('|||');
            
            const existing = await db.select().from(cqDiagnoses).where(eq(cqDiagnoses.code, code)).limit(1);
            if (existing.length > 0) {
                finalPostDiagnosisIds.push(existing[0].id);
            } else {
                const [inserted] = await db.insert(cqDiagnoses).values({
                    code: code.substring(0, 20),
                    name: name,
                    isActive: true,
                    isVerifiedMinsa: true
                }).returning({ id: cqDiagnoses.id });
                if (inserted) finalPostDiagnosisIds.push(inserted.id);
            }
        } else {
            finalPostDiagnosisIds.push(did);
        }
    }
    const truePostDiagnosesIds = [...new Set(finalPostDiagnosisIds)];

    // Resolve diagnosis details from True IDs to text for legacy/easy reading
    const selectedDiags = await db.select().from(cqDiagnoses).where(inArray(cqDiagnoses.id, trueDiagnosesIds));
    const diagnosisText = selectedDiags.map(d => `${d.code} - ${d.name}`).join(", ");

    const selectedPostDiags = truePostDiagnosesIds.length > 0 ? await db.select().from(cqDiagnoses).where(inArray(cqDiagnoses.id, truePostDiagnosesIds)) : [];
    const postDiagnosisText = selectedPostDiags.map(d => `${d.code} - ${d.name}`).join(", ");

    const roomId = operatingRoomId ? operatingRoomId : null;

    // Combine date and time
    const isTimeDefined = Boolean(scheduledTimeStr);
    const timeToStore = isTimeDefined ? scheduledTimeStr : "00:00";
    const scheduledDate = new Date(`${scheduledDateStr}T${timeToStore}:00`);

    if (roomId && isTimeDefined) {
        const newStartMs = scheduledDate.getTime();
        const newEndMs = newStartMs + getDurationMs(estimatedDuration);

        // Fetch active surgeries for this specific operating room excluding THIS surgery
        const existingSurgeries = await db.select()
            .from(cqSurgeries)
            .where(
                and(
                    eq(cqSurgeries.operatingRoomId, roomId),
                    ne(cqSurgeries.id, id),
                    ne(cqSurgeries.status, 'cancelled'),
                    eq(cqSurgeries.isTimeDefined, true)
                )
            );

        for (const surgery of existingSurgeries) {
            const existingStartMs = surgery.scheduledDate.getTime();
            const existingEndMs = existingStartMs + getDurationMs(surgery.estimatedDuration || "1 hora");

            if (newStartMs < existingEndMs && newEndMs > existingStartMs) {
                const dateStr = surgery.scheduledDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const timeStr = surgery.scheduledDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
                return { error: `La sala seleccionada sufre un cruce de horarios.\n\nExiste una cirugÃƒÂ­a programada para el ${dateStr} a las ${timeStr} que durarÃƒÂ¡ aprox. ${surgery.estimatedDuration || "1 hora"}. Sus lapsos de ocupaciÃƒÂ³n se sobreponen.` };
            }
        }
    }

    let finalPatientId: string;
    const existingPii = await db.select().from(cqPatientPii).where(
        or(
            eq(cqPatientPii.dni, patientId),
            eq(cqPatientPii.historiaClinica, patientId),
            eq(cqPatientPii.carnetExtranjeria, patientId),
            eq(cqPatientPii.pasaporte, patientId)
        )
    );

    if (existingPii.length > 0) {
        finalPatientId = existingPii[0].patientId;

        // Update patient's address/ubigeo if apiData was sent
        const apiPatientDataRaw = formData.get("api_patient_data") as string | null;
        if (apiPatientDataRaw) {
            try {
                const parsed = JSON.parse(apiPatientDataRaw);
                const pUbigeo = parsed.ubigeo || null;
                const pDireccion = parsed.direccion || null;
                
                if (pUbigeo) {
                    await db.update(cqPatients).set({ ubigeo: pUbigeo }).where(eq(cqPatients.id, finalPatientId));
                }
                if (pDireccion) {
                    await db.update(cqPatientPii).set({ direccion: pDireccion }).where(eq(cqPatientPii.patientId, finalPatientId));
                }
            } catch (e) {
                console.error("Failed to update patient address/ubigeo from apiData in editSurgery", e);
            }
        }

        const bloodGroupRh = formData.get("blood_group_rh") as string | null;
        if (bloodGroupRh) {
            await db.update(cqPatientPii).set({ bloodGroupRh }).where(eq(cqPatientPii.patientId, finalPatientId));
        }
    } else {
        const apiPatientDataRaw = formData.get("api_patient_data") as string | null;
        let pName = 'NO IDENTIFICADO';
        let pLastName = 'NO IDENTIFICADO';
        let pSexo = null;
        let pFechaNac = null;
        let pUbigeo = null;
        let pHistoriaClinica = patientId;
        let pDireccion = null;

        if (apiPatientDataRaw) {
            try {
                const parsed = JSON.parse(apiPatientDataRaw);
                pName = parsed.nombres || pName;
                pLastName = parsed.apellidos || pLastName;
                pSexo = parsed.sexo || null;
                pFechaNac = parsed.fechaNacimiento ? new Date(parsed.fechaNacimiento) : null;
                pUbigeo = parsed.ubigeo || null;
                pHistoriaClinica = parsed.historiaClinica || pHistoriaClinica;
                pDireccion = parsed.direccion || null;
            } catch (e) {
                console.error("Failed to parse api_patient_data", e);
            }
        }

        try {
            // Demographics
            const [newPat] = await db.insert(cqPatients).values({
                sexo: pSexo,
                fechaNacimiento: pFechaNac,
                ubigeo: pUbigeo,
            }).returning({ id: cqPatients.id });
            
            finalPatientId = newPat.id;

            // Identity Vault
            const bloodGroupRh = formData.get("blood_group_rh") as string | null;
            await db.insert(cqPatientPii).values({
                patientId: finalPatientId,
                dni: patientId,
                nombres: pName,
                apellidos: pLastName,
                historiaClinica: pHistoriaClinica,
                direccion: pDireccion,
                bloodGroupRh
            });
        } catch (dbErr) {
            // Fallback total: si algo falló en la inserción (carrera de procesos), buscamos de nuevo
            const lastHope = await db.select().from(cqPatientPii).where(
                or(
                    eq(cqPatientPii.dni, patientId),
                    eq(cqPatientPii.historiaClinica, patientId)
                )
            ).limit(1);
            if (lastHope.length > 0) {
                finalPatientId = lastHope[0].patientId;
            } else {
                throw dbErr; // Si no existe de verdad, dejamos que falle
            }
        }
    }

    await db.update(cqSurgeries).set({
        patientId: finalPatientId,
        operatingRoomId: roomId,
        requestDate: requestDateStr || new Date().toISOString().split('T')[0],
        scheduledDate,
        isTimeDefined,
        estimatedDuration,
        diagnosis: diagnosisText,
        postDiagnosis: postDiagnosisText,
        surgeryType,
        urgencyType: urgencyType || 'ELECTIVO',
        insuranceType,
        anesthesiaType,
        origin,
        bedNumber: bedNumber || null,
        internalCode: internalCode || null,
        specialtyId: specialtyId || null,
        notes,
        isFromCopri,
        isRescheduled,
        isReintervention,
        hasHypoxicEncephalopathy,
        hasUrpaComplication,
        diedInSurgery,
        diedInUrpa,
        updatedAt: new Date(),
    }).where(eq(cqSurgeries.id, id));

    // Clear and Re-insert team
    await db.delete(cqSurgeryTeam).where(eq(cqSurgeryTeam.surgeryId, id));

    const teamInserts: any[] = [];
    for (const sid of surgeonIds) {
        teamInserts.push({ surgeryId: id, staffUserId: sid, roleInSurgery: 'CIRUJANO' });
    }
    for (const aid of anesthesiologistIds) {
        teamInserts.push({ surgeryId: id, staffUserId: aid, roleInSurgery: 'ANESTESIOLOGO' });
    }
    for (const nid of instrumentistaIds) {
        teamInserts.push({ surgeryId: id, staffUserId: nid, roleInSurgery: 'INSTRUMENTISTA' });
    }
    for (const nid of circulanteIds) {
        teamInserts.push({ surgeryId: id, staffUserId: nid, roleInSurgery: 'CIRCULANTE' });
    }

    if (teamInserts.length > 0) {
        await db.insert(cqSurgeryTeam).values(teamInserts);
    }

    // Clear and Re-insert Diagnoses
    await db.delete(cqSurgeryDiagnoses).where(eq(cqSurgeryDiagnoses.surgeryId, id));
    const diagInserts = trueDiagnosesIds.map(did => ({ surgeryId: id, diagnosisId: did }));
    if (diagInserts.length > 0) {
        await db.insert(cqSurgeryDiagnoses).values(diagInserts).onConflictDoNothing();
    }

    // Clear and Re-insert Post Diagnoses
    await db.delete(cqSurgeryPostDiagnoses).where(eq(cqSurgeryPostDiagnoses.surgeryId, id));
    const postDiagInserts = truePostDiagnosesIds.map(did => ({ surgeryId: id, diagnosisId: did }));
    if (postDiagInserts.length > 0) {
        await db.insert(cqSurgeryPostDiagnoses).values(postDiagInserts).onConflictDoNothing();
    }

    // Clear and Re-insert Procedures
    await db.delete(cqSurgeryProcedures).where(eq(cqSurgeryProcedures.surgeryId, id));
    const procInserts = trueProceduresIds.map(pid => ({ surgeryId: id, procedureId: pid }));
    if (procInserts.length > 0) {
        await db.insert(cqSurgeryProcedures).values(procInserts).onConflictDoNothing();
    }

    // Clear and Re-insert Interventions
    await db.delete(cqSurgeryInterventions).where(eq(cqSurgeryInterventions.surgeryId, id));
    const interInserts = interventionsIds.map(iid => ({ surgeryId: id, interventionId: iid }));
    if (interInserts.length > 0) {
        await db.insert(cqSurgeryInterventions).values(interInserts).onConflictDoNothing();
    }

    revalidatePath("/dashboard/programaciones");
    revalidatePath("/dashboard/pacientes");
}

export async function updateSurgeryPhaseTimes(data: {
    surgeryId: string;
    actualStartTime?: string | null;
    anesthesiaStartTime?: string | null;
    preIncisionTime?: string | null;
    surgeryEndTime?: string | null;
    patientExitTime?: string | null;
    urpaExitTime?: string | null;
    completedTime?: string | null;
}) {
    if (!data.surgeryId) return { error: "ID de cirugía es requerido" };
    
    try {
        const surgeryRow = await db.select({ status: cqSurgeries.status }).from(cqSurgeries).where(eq(cqSurgeries.id, data.surgeryId)).limit(1);
        if (surgeryRow.length === 0) return { error: "Cirugía no encontrada" };
        let status = surgeryRow[0].status;

        if (status !== 'cancelled') {
            if (data.completedTime) {
                status = 'completed';
            } else if (data.urpaExitTime) {
                status = 'urpa_exit';
            } else if (data.patientExitTime) {
                status = 'patient_exit';
            } else if (data.surgeryEndTime) {
                status = 'surgery_end';
            } else if (data.preIncisionTime) {
                status = 'pre_incision';
            } else if (data.anesthesiaStartTime) {
                status = 'anesthesia_start';
            } else if (data.actualStartTime) {
                status = 'in_progress';
            } else {
                status = 'scheduled';
            }
        }

        await db.update(cqSurgeries).set({
            actualStartTime: data.actualStartTime ? new Date(data.actualStartTime) : null,
            anesthesiaStartTime: data.anesthesiaStartTime ? new Date(data.anesthesiaStartTime) : null,
            preIncisionTime: data.preIncisionTime ? new Date(data.preIncisionTime) : null,
            surgeryEndTime: data.surgeryEndTime ? new Date(data.surgeryEndTime) : null,
            patientExitTime: data.patientExitTime ? new Date(data.patientExitTime) : null,
            urpaExitTime: data.urpaExitTime ? new Date(data.urpaExitTime) : null,
            completedTime: data.completedTime ? new Date(data.completedTime) : null,
            status,
            updatedAt: new Date(),
        }).where(eq(cqSurgeries.id, data.surgeryId));
        
        revalidatePath("/dashboard/programaciones");
        revalidatePath("/dashboard/pacientes");
        return { success: true };
    } catch (error: any) {
        console.error("Error updating phase times:", error);
        return { error: "Ocurrió un error al actualizar los tiempos." };
    }
}
