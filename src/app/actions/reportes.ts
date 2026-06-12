"use server";

import { db } from "@/db";
import { 
  cqSurgicalReports, cqSurgeries, usersTable, 
  cqOperatingRooms, cqSpecialties, cqPatients, cqPatientPii, cqSurgeryTeam, cqSurgeryProcedures, cqProcedures, cqSurgeryDiagnoses, cqDiagnoses,
  cqInterventionTypes, cqSurgeryInterventions, cqSurgeryPostDiagnoses
} from "@/db/schema";
import { eq, and, gte, lte, inArray, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";

export async function getSurgery(id: string) {
    const [data] = await db
        .select({
            surgery: cqSurgeries,
            patient: cqSurgeries.patientId, // Ideally this bridges to a patient catalog
        })
        .from(cqSurgeries)
        .where(eq(cqSurgeries.id, id));
    return data;
}

export async function getSurgicalReport(surgeryId: string) {
    const [data] = await db
        .select({
            report: cqSurgicalReports,
            surgeon: usersTable,
        })
        .from(cqSurgicalReports)
        .innerJoin(usersTable, eq(cqSurgicalReports.surgeonId, usersTable.id))
        .where(eq(cqSurgicalReports.surgeryId, surgeryId));
    return data;
}

export async function createSurgicalReport(formData: FormData) {
    const surgeryId = formData.get("surgery_id") as string;
    const surgeonId = formData.get("surgeon_id") as string; // Will come from NextAuth session
    const preOpDiagnosis = formData.get("pre_op_diagnosis") as string;
    const postOpDiagnosis = formData.get("post_op_diagnosis") as string;
    const surgicalProcedure = formData.get("surgical_procedure") as string;
    const findings = formData.get("findings") as string;
    const bloodLoss = formData.get("blood_loss") as string;
    const complications = formData.get("complications") as string;
    const file = formData.get("file") as File;

    if (!surgeryId || !surgeonId || !surgicalProcedure) {
        throw new Error("Missing mandatory fields for surgical report");
    }

    let documentUrl = null;

    // Upload PDF securely to Supabase Storage Bucket
    if (file && file.size > 0) {
        const ext = file.name.split('.').pop();
        const fileName = `${surgeryId}-reporte-${Date.now()}.${ext}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('centroquirurgico')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) {
            console.error("Supabase Storage Error:", uploadError);
            throw new Error("Al subir el documento adjunto al Bucket.");
        }

        // Get public URL (Assuming 'centroquirurgico' is a public bucket in this instance. For highly sensitive data it should be private with SignedUrls, but we follow standard Vercel ready structure for now).
        const { data: urlData } = supabase.storage
            .from('centroquirurgico')
            .getPublicUrl(fileName);

        documentUrl = urlData.publicUrl;
    }

    await db.insert(cqSurgicalReports).values({
        surgeryId,
        surgeonId,
        preOpDiagnosis,
        postOpDiagnosis,
        surgicalProcedure,
        findings,
        bloodLoss,
        complications,
        documentUrl,
    });

    revalidatePath(`/dashboard/programaciones/${surgeryId}/reporte`);
}

function getMonthName(date: Date) {
    const localDateStr = date.toLocaleString("en-US", { timeZone: "America/Lima", month: "long" });
    const months: Record<string, string> = {
        "January": "ENERO", "February": "FEBRERO", "March": "MARZO", "April": "ABRIL",
        "May": "MAYO", "June": "JUNIO", "July": "JULIO", "August": "AGOSTO",
        "September": "SEPTIEMBRE", "October": "OCTUBRE", "November": "NOVIEMBRE", "December": "DICIEMBRE"
    };
    return months[localDateStr] || localDateStr.toUpperCase();
}

function calculateAge(birthDate: Date | null, targetDate: Date) {
    if (!birthDate) return "";
    let age = targetDate.getFullYear() - birthDate.getFullYear();
    const m = targetDate.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && targetDate.getDate() < birthDate.getDate())) {
        age--;
    }
    return age.toString();
}

export async function fetchSurgeryReportData(startDateStr: string, endDateStr: string) {
    const startDate = new Date(`${startDateStr}T00:00:00-05:00`);
    const endDate = new Date(`${endDateStr}T23:59:59-05:00`);

    const surgeries = await db.select({
        surgery: cqSurgeries,
        room: cqOperatingRooms,
        specialty: cqSpecialties,
        patient: cqPatients,
        pii: cqPatientPii
    })
    .from(cqSurgeries)
    .leftJoin(cqOperatingRooms, eq(cqSurgeries.operatingRoomId, cqOperatingRooms.id))
    .leftJoin(cqSpecialties, eq(cqSurgeries.specialtyId, cqSpecialties.id))
    .innerJoin(cqPatients, eq(cqSurgeries.patientId, cqPatients.id))
    .leftJoin(cqPatientPii, eq(cqPatients.id, cqPatientPii.patientId))
    .where(and(
        gte(cqSurgeries.scheduledDate, startDate),
        lte(cqSurgeries.scheduledDate, endDate)
    ))
    .orderBy(desc(cqSurgeries.scheduledDate));

    if (surgeries.length === 0) return [];

    const surgeryIds = surgeries.map(s => s.surgery.id);

    const teams = await db.select({
        surgeryId: cqSurgeryTeam.surgeryId,
        role: cqSurgeryTeam.roleInSurgery,
        staff: usersTable
    })
    .from(cqSurgeryTeam)
    .innerJoin(usersTable, eq(cqSurgeryTeam.staffUserId, usersTable.id))
    .where(inArray(cqSurgeryTeam.surgeryId, surgeryIds));

    const diagRecords = await db.select({
        surgeryId: cqSurgeryDiagnoses.surgeryId,
        diagnosis: cqDiagnoses
    })
    .from(cqSurgeryDiagnoses)
    .innerJoin(cqDiagnoses, eq(cqSurgeryDiagnoses.diagnosisId, cqDiagnoses.id))
    .where(inArray(cqSurgeryDiagnoses.surgeryId, surgeryIds));

    const postDiagRecords = await db.select({
        surgeryId: cqSurgeryPostDiagnoses.surgeryId,
        diagnosis: cqDiagnoses
    })
    .from(cqSurgeryPostDiagnoses)
    .innerJoin(cqDiagnoses, eq(cqSurgeryPostDiagnoses.diagnosisId, cqDiagnoses.id))
    .where(inArray(cqSurgeryPostDiagnoses.surgeryId, surgeryIds));

    const intRecords = await db.select({
        surgeryId: cqSurgeryInterventions.surgeryId,
        intervention: cqInterventionTypes
    })
    .from(cqSurgeryInterventions)
    .innerJoin(cqInterventionTypes, eq(cqSurgeryInterventions.interventionId, cqInterventionTypes.id))
    .where(inArray(cqSurgeryInterventions.surgeryId, surgeryIds));

    return surgeries.map((s, index) => {
        const formatDateTime = (dateVal: Date | null) => {
            if (!dateVal) return "";
            const d = new Date(dateVal);
            const dStr = d.toLocaleDateString("es-PE", {timeZone: 'America/Lima'});
            const tStr = d.toLocaleTimeString("es-PE", {hour: '2-digit', minute:'2-digit', hour12:false, timeZone: 'America/Lima'});
            return `${dStr} ${tStr}`;
        };

        const surgeryTeam = teams.filter(t => t.surgeryId === s.surgery.id);
        const surgeryDiags = diagRecords.filter(d => d.surgeryId === s.surgery.id).map(d => d.diagnosis.name);
        const surgeryPostDiags = postDiagRecords.filter(d => d.surgeryId === s.surgery.id).map(d => d.diagnosis.name);
        const surgeryInts = intRecords.filter(i => i.surgeryId === s.surgery.id).map(i => i.intervention.name);

        const surgeons = surgeryTeam.filter(t => t.role === 'CIRUJANO').map(t => `${t.staff.name} ${t.staff.lastname}`).join(" / ");
        const anesthesiologists = surgeryTeam.filter(t => t.role === 'ANESTESIOLOGO').map(t => `${t.staff.name} ${t.staff.lastname}`).join(" / ");
        const instrumentistas = surgeryTeam.filter(t => t.role === 'INSTRUMENTISTA').map(t => `${t.staff.name} ${t.staff.lastname}`).join(" / ");
        const circulantes = surgeryTeam.filter(t => t.role === 'CIRCULANTE').map(t => `${t.staff.name} ${t.staff.lastname}`).join(" / ");

        const combinedDiagnoses = s.surgery.diagnosis ? (surgeryDiags.length > 0 ? `${s.surgery.diagnosis} | ${surgeryDiags.join(" | ")}` : s.surgery.diagnosis) : surgeryDiags.join(" | ");
        const combinedPostDiagnoses = s.surgery.postDiagnosis ? (surgeryPostDiags.length > 0 ? `${s.surgery.postDiagnosis} | ${surgeryPostDiags.join(" | ")}` : s.surgery.postDiagnosis) : surgeryPostDiags.join(" | ");

        let rawSex = s.patient.sexo || "";
        let formattedSex = "";
        if (rawSex.toLowerCase().startsWith('m')) formattedSex = 'M';
        if (rawSex.toLowerCase().startsWith('f')) formattedSex = 'F';

        let turno = "";
        if (s.surgery.actualStartTime) {
            const h = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Lima' }).format(new Date(s.surgery.actualStartTime)), 10);
            const hour = h === 24 ? 0 : h;
            if (hour >= 6 && hour < 12) turno = "MAÑANA";
            else if (hour >= 12 && hour < 18) turno = "TARDE";
            else if (hour >= 18 && hour <= 23) turno = "NOCHE";
            else if (hour >= 0 && hour < 6) turno = "MADRUGADA";
        }

        return {
            correlativo: index + 1,
            especialidad: s.specialty?.name || "",
            sala: s.room?.name || "Sin Asignar",
            fechaProgramacion: s.surgery.createdAt ? new Date(s.surgery.createdAt).toLocaleDateString("es-PE", {timeZone: 'America/Lima'}) : "",
            horaProgramada: s.surgery.scheduledDate ? new Date(s.surgery.scheduledDate).toLocaleTimeString("es-PE", {hour: '2-digit', minute:'2-digit', hour12:true, timeZone: 'America/Lima'}) : "",
            fechaSolicitud: s.surgery.requestDate ? new Date(s.surgery.requestDate + "T00:00:00").toLocaleDateString("es-PE", {timeZone: 'America/Lima'}) : "",
            edad: calculateAge(s.patient.fechaNacimiento, new Date(s.surgery.scheduledDate)),
            sexo: formattedSex,
            documento: s.pii?.dni || s.pii?.carnetExtranjeria || s.pii?.pasaporte || "",
            historiaClinica: s.pii?.historiaClinica || s.pii?.dni || s.pii?.carnetExtranjeria || "",
            nombresApellidos: `${s.pii?.nombres || ''} ${s.pii?.apellidos || ''}`.trim(),
            diagnostico: combinedDiagnoses,
            diagnosticoPost: combinedPostDiagnoses,
            tipoDiagnostico: s.surgery.surgeryType || "",
            tipoIntervencion: surgeryInts.join(" / "),
            cirujano: surgeons,
            anestesiologo: anesthesiologists,
            instrumentista: instrumentistas,
            circulante: circulantes,
            tipoSeguro: s.surgery.insuranceType || "",
            procedencia: s.surgery.origin || "",
            tipoAnestesia: s.surgery.anesthesiaType || "",
            horaIngresoPaciente: formatDateTime(s.surgery.actualStartTime),
            horaInicioAnestesia: formatDateTime(s.surgery.anesthesiaStartTime),
            horaAntesIncision: formatDateTime(s.surgery.preIncisionTime),
            horaTerminoCirugia: formatDateTime(s.surgery.surgeryEndTime),
            horaSalidaPaciente: formatDateTime(s.surgery.patientExitTime),
            horaSalidaUrpa: formatDateTime(s.surgery.urpaExitTime),
            fechaIntervencionQuirurgica: s.surgery.scheduledDate ? new Date(s.surgery.scheduledDate).toLocaleDateString("es-PE", {timeZone: 'America/Lima'}) : "",
            fechaRealIntervencion: s.surgery.actualStartTime ? new Date(s.surgery.actualStartTime).toLocaleDateString("es-PE", {timeZone: 'America/Lima'}) : "",
            horaRealIntervencion: s.surgery.actualStartTime ? new Date(s.surgery.actualStartTime).toLocaleTimeString("es-PE", {hour: '2-digit', minute:'2-digit', hour12:false, timeZone: 'America/Lima'}) : "",
            tipoPrioridad: s.surgery.urgencyType || "",
            mesIntervencion: s.surgery.actualStartTime ? getMonthName(new Date(s.surgery.actualStartTime)) : "",
            estadoAlerta: s.surgery.status,
            turno: turno
        };
    });
}
