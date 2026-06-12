"use server";

import { db } from "@/db";
import { cqPatientPii, cqPatients, cqSurgeries, cqUbigeo } from "@/db/schema";
import { eq, or, ilike } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Helper to reliably parse YYYY-MM-DD into a localized Date 
// avoiding UTC midnight jumps that push dates a day backwards
const parseLocalDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const baseDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    return new Date(`${baseDateStr}T12:00:00`);
};

export async function lookupPatientByDni(rawId: string) {
    if (!rawId) return null;
    const dni = rawId.trim();
    if (dni.length < 8) return null;

    try {
        const result = await db
            .select({
                pii: cqPatientPii,
                patient: cqPatients,
                ubigeo: cqUbigeo
            })
            .from(cqPatientPii)
            .innerJoin(cqPatients, eq(cqPatientPii.patientId, cqPatients.id))
            .leftJoin(cqUbigeo, eq(cqPatients.ubigeo, cqUbigeo.code))
            .where(
                or(
                    eq(cqPatientPii.dni, dni),
                    eq(cqPatientPii.historiaClinica, dni),
                    eq(cqPatientPii.carnetExtranjeria, dni),
                    eq(cqPatientPii.pasaporte, dni)
                )
            );

        let localPatient = result.length > 0 ? result[0] : null;

        // Si ya está en la bóveda y NO se llama "No Identificado", lo devolvemos rápido.
        if (localPatient && localPatient.pii.nombres.toUpperCase() !== 'NO IDENTIFICADO') {
            return {
                found: true,
                fullName: `${localPatient.pii.nombres} ${localPatient.pii.apellidos}`,
                source: 'Registro Local CQ (Bóveda)',
                direccion: localPatient.pii.direccion,
                distrito: localPatient.ubigeo?.distrito || null,
                provincia: localPatient.ubigeo?.provincia || null,
                departamento: localPatient.ubigeo?.departamento || null,
                apiData: null
            };
        }

        // --- Llamada a la API externa ApiNetHos ---
        let externalPatientData = null;
        let isApiError = false;

        try {
            // Utilizamos la URL base configurada o la IP de tu servidor
            const apiUrl = process.env.API_NETHOS_URL || "http://192.168.41.25:3010";
            const response = await fetch(`${apiUrl}/api/pacientes/search?documento=${dni}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            });

            if (response.ok) {
                const data = await response.json();
                
                // Mapear según la estructura de tu API: data.data es un array
                if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                    externalPatientData = data.data[0]; 
                } else if (data.data && !Array.isArray(data.data) && data.data.nombres) {
                    // Por si la estructura viniera directamente envuelta en otra forma sin array
                    externalPatientData = data.data;
                }
            }
        } catch (err) {
            console.error("Error contactando ApiNetHos:", err);
            isApiError = true;
        }

        // Parseamos lo obtenido o definimos por defecto
        let pName = "NO IDENTIFICADO";
        let pLastName = "NO IDENTIFICADO";
        let sexo = null;
        let fechaNac = null;
        let ubi = null;
        let pDireccion = null;
        let pHistoriaClinica = dni; // Placeholder provisional para HC si no viene observacion
        let pFoundInApi = false;

        if (externalPatientData && (externalPatientData.nombres || externalPatientData.apellidoPaterno)) {
            pName = (externalPatientData.nombres || "").trim() || "NO IDENTIFICADO";
            // Juntamos apellido paterno y materno
            pLastName = [
                (externalPatientData.apellidoPaterno || "").trim(),
                (externalPatientData.apellidoMaterno || "").trim()
            ].filter(Boolean).join(" ") || "NO IDENTIFICADO";
            
            // Evaluamos el sexo
            if (externalPatientData.sexo === "M" || externalPatientData.sexo === "Masculino") sexo = "Masculino";
            else if (externalPatientData.sexo === "F" || externalPatientData.sexo === "Femenino") sexo = "Femenino";
            
            // Evaluamos fecha de nacimiento
            if (externalPatientData.fechaNacimiento) {
                fechaNac = parseLocalDate(externalPatientData.fechaNacimiento);
            }

            // Evaluamos observacion (Historia Clínica en NetHos)
            if (externalPatientData.observacion) {
                pHistoriaClinica = (externalPatientData.observacion || "").trim();
            }

            // Evaluamos ubigeo
            const rawUbi = externalPatientData.codigoInei || externalPatientData.ubigeoinei;
            if (rawUbi) {
                ubi = rawUbi.toString().trim();
            }

            // Evaluamos direccion
            if (externalPatientData.direccion) {
                pDireccion = (externalPatientData.direccion || "").trim();
            }

            pFoundInApi = true;
        }

        const fullName = `${pName} ${pLastName}`;

        let extDistrito = externalPatientData?.distrito ? externalPatientData.distrito.toString().trim() : null;
        let extProvincia = externalPatientData?.provincia ? externalPatientData.provincia.toString().trim() : null;
        let extDepartamento = externalPatientData?.departamento ? externalPatientData.departamento.toString().trim() : null;

        if (ubi && (!extDistrito || !extProvincia || !extDepartamento)) {
            const ubiInfo = await db.select().from(cqUbigeo).where(eq(cqUbigeo.code, ubi)).limit(1);
            if (ubiInfo.length > 0) {
                if (!extDistrito) extDistrito = ubiInfo[0].distrito;
                if (!extProvincia) extProvincia = ubiInfo[0].provincia;
                if (!extDepartamento) extDepartamento = ubiInfo[0].departamento;
            }
        }

        if (localPatient) {
            // Ya existía en Bóveda (posiblemente como "No Identificado")
            if (pFoundInApi) {
                return {
                    found: true,
                    fullName,
                    source: 'Registro Local CQ (Bóveda / API Sync)',
                    direccion: pDireccion,
                    distrito: extDistrito,
                    provincia: extProvincia,
                    departamento: extDepartamento,
                    apiData: JSON.stringify({
                        sexo,
                        fechaNacimiento: fechaNac ? fechaNac.toISOString() : null,
                        ubigeo: ubi,
                        nombres: pName,
                        apellidos: pLastName,
                        historiaClinica: pHistoriaClinica,
                        direccion: pDireccion,
                        dni: dni,
                        distrito: extDistrito,
                        provincia: extProvincia,
                        departamento: extDepartamento
                    })
                };
            }

            // Si la API falló y ya lo teníamos como "NO IDENTIFICADO" o similar
            return {
                found: true,
                fullName: `${localPatient.pii.nombres} ${localPatient.pii.apellidos}`,
                source: 'Registro Local CQ (Bóveda)',
                direccion: localPatient.pii.direccion,
                distrito: localPatient.ubigeo?.distrito || null,
                provincia: localPatient.ubigeo?.provincia || null,
                departamento: localPatient.ubigeo?.departamento || null,
                apiData: null
            };
        } else {
            // NO existía localmente, transferimos la decisión visual
            if (pFoundInApi) {
                // Retornamos la info para que sea guardada al "Confirmar Cirugía"
                return { 
                    found: true, 
                    fullName, 
                    source: 'ApiNetHos (Virtual)',
                    direccion: pDireccion,
                    distrito: extDistrito,
                    provincia: extProvincia,
                    departamento: extDepartamento,
                    apiData: JSON.stringify({
                        sexo,
                        fechaNacimiento: fechaNac ? fechaNac.toISOString() : null,
                        ubigeo: ubi,
                        nombres: pName,
                        apellidos: pLastName,
                        historiaClinica: pHistoriaClinica,
                        direccion: pDireccion,
                        dni: dni,
                        distrito: extDistrito,
                        provincia: extProvincia,
                        departamento: extDepartamento
                    })
                };
            } else {
                return { found: false, source: null, apiData: null };
            }
        }
    } catch (error) {
        console.error("Error looking up DNI:", error);
        return { found: false, source: null, apiData: null };
    }
}

export async function lookupPatientsInApi(query: string) {
    if (!query || query.trim().length < 3) return [];
    
    try {
        const apiUrl = process.env.API_NETHOS_URL || "http://192.168.41.25:3010";
        // Reemplazar espacios por '+' ya que API MINSA no admite %20 correctamente
        const parsedQuery = query.trim().split(/\s+/).join('+');
        const response = await fetch(`${apiUrl}/api/pacientes/search?q=${parsedQuery}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        if (!response.ok) return [{ __apiError: true }];
        const data = await response.json();
        
        if (data.data && Array.isArray(data.data)) {
            const mappedPats = await Promise.all(data.data.map(async (externalPatientData: any) => {
                const dni = externalPatientData.documentoNumero || "";
                const pName = (externalPatientData.nombres || "").trim() || "NO IDENTIFICADO";
                const pLastName = [
                    (externalPatientData.apellidoPaterno || "").trim(),
                    (externalPatientData.apellidoMaterno || "").trim()
                ].filter(Boolean).join(" ") || "NO IDENTIFICADO";
                let sexo = null;
                if (externalPatientData.sexo === "M" || externalPatientData.sexo === "Masculino") sexo = "Masculino";
                else if (externalPatientData.sexo === "F" || externalPatientData.sexo === "Femenino") sexo = "Femenino";
                
                const fechaNac = parseLocalDate(externalPatientData.fechaNacimiento);
                const pHistoriaClinica = (externalPatientData.observacion || "").trim() || dni;
                const rawUbi = externalPatientData.codigoInei || externalPatientData.ubigeoinei;
                const ubi = rawUbi ? rawUbi.toString().trim() : null;
                const pDireccion = (externalPatientData.direccion || "").trim();

                let extDistrito = externalPatientData.distrito ? externalPatientData.distrito.toString().trim() : "";
                let extProvincia = externalPatientData.provincia ? externalPatientData.provincia.toString().trim() : "";
                let extDepartamento = externalPatientData.departamento ? externalPatientData.departamento.toString().trim() : "";

                if (ubi && (!extDistrito || !extProvincia || !extDepartamento)) {
                    const ubiInfo = await db.select().from(cqUbigeo).where(eq(cqUbigeo.code, ubi)).limit(1);
                    if (ubiInfo.length > 0) {
                        if (!extDistrito) extDistrito = ubiInfo[0].distrito;
                        if (!extProvincia) extProvincia = ubiInfo[0].provincia;
                        if (!extDepartamento) extDepartamento = ubiInfo[0].departamento;
                    }
                }

                const apiDataStr = JSON.stringify({
                    sexo,
                    fechaNacimiento: fechaNac ? fechaNac.toISOString() : null,
                    ubigeo: ubi,
                    nombres: pName,
                    apellidos: pLastName,
                    historiaClinica: pHistoriaClinica,
                    direccion: pDireccion,
                    dni: dni,
                    distrito: extDistrito,
                    provincia: extProvincia,
                    departamento: extDepartamento
                });

                return {
                    id: `__api_pat__${dni}`,
                    pii: {
                        dni: dni,
                        nombres: pName,
                        apellidos: pLastName
                    },
                    apiData: apiDataStr
                };
            }));
            return mappedPats.filter((p: any) => p.pii.dni); // Ensure they have a DNI
        }
        return [];
    } catch (e) {
        console.error("Error contactando ApiNetHos (Patients Array):", e);
        return [{ __apiError: true }];
    }
}

export async function importMultiplePatients(apiDataList: string[]) {
    let importedCount = 0;
    try {
        for (const dataStr of apiDataList) {
            if (!dataStr) continue;
            const parsed = JSON.parse(dataStr);
            const dni = parsed.dni;
            if (!dni) continue;

            const existingPii = await db.select().from(cqPatientPii).where(eq(cqPatientPii.dni, dni));
            if (existingPii.length > 0) continue; // Skip existing

            // 1. Insert Profile (cqPatients) to generate ID
            const [newPatient] = await db.insert(cqPatients).values({
                fechaNacimiento: parseLocalDate(parsed.fechaNacimiento),
                sexo: parsed.sexo || null,
                ubigeo: parsed.ubigeo || null,
            }).returning({ id: cqPatients.id });

            if (newPatient && newPatient.id) {
                // 2. Insert PII (cqPatientPii)
                await db.insert(cqPatientPii).values({
                    patientId: newPatient.id,
                    dni: parsed.dni,
                    nombres: parsed.nombres?.trim() || "NO IDENTIFICADO",
                    apellidos: parsed.apellidos?.trim() || "NO IDENTIFICADO",
                    historiaClinica: parsed.historiaClinica || null,
                    direccion: parsed.direccion || null,
                });
                importedCount++;
            }
        }
        revalidatePath('/dashboard/pacientes');
        revalidatePath('/dashboard/programaciones');
        return { success: true, count: importedCount };
    } catch (e) {
        console.error("Error importMultiplePatients:", e);
        return { success: false, error: "Error en la importación masiva" };
    }
}

export async function createTemporaryPatient(searchboxDni: string, rawInput: string) {
    if (!rawInput) return { error: "Datos incompletos" };
    
    let parts = rawInput.trim().split(/\s+/);
    let dniToSave = searchboxDni.trim();
    let computedSex = null;
    
    // 1. Check if the user typed the DNI again at the start of the string
    if (parts.length > 0 && (/^\d{8,12}$/.test(parts[0]) || /^[A-Z0-9]{8,15}$/i.test(parts[0]))) {
        dniToSave = parts.shift()!;
    }
    
    // 2. Check if the next word is the Sex (M, F, MASCULINO, FEMENINO)
    if (parts.length > 0) {
        const sexChar = parts[0].toUpperCase();
        if (["M", "MASCULINO", "HOMBRE"].includes(sexChar)) {
            computedSex = "Masculino";
            parts.shift();
        } else if (["F", "FEMENINO", "MUJER"].includes(sexChar)) {
            computedSex = "Femenino";
            parts.shift();
        }
    }
    
    // 3. The rest is Nombres y Apellidos
    const n = parts.slice(0, Math.ceil(parts.length / 2)).join(' ');
    const a = parts.slice(Math.ceil(parts.length / 2)).join(' ');

    try {
        // Prevent duplicate insertions
        const existingPii = await db.select().from(cqPatientPii).where(
            or(
                eq(cqPatientPii.dni, dniToSave),
                eq(cqPatientPii.historiaClinica, dniToSave),
                eq(cqPatientPii.carnetExtranjeria, dniToSave),
                eq(cqPatientPii.pasaporte, dniToSave)
            )
        );
        if (existingPii.length > 0) return { error: "Ya existe" };

        const newPat = await db.insert(cqPatients).values({
            sexo: computedSex
        }).returning({ id: cqPatients.id });
        
        await db.insert(cqPatientPii).values({
            patientId: newPat[0].id,
            dni: dniToSave,
            nombres: n ? `${n} (TEMP)` : "NO IDENTIFICADO",
            apellidos: a ? `${a} (TEMP)` : "NO IDENTIFICADO"
        });
        
        revalidatePath("/dashboard", "layout");
        
        return { success: true };
    } catch (e) {
        console.error(e);
        return { error: "Error al crear paciente" };
    }
}


export async function getPacientes() {
    try {
        const result = await db
            .select({
                patient: cqPatients,
                pii: cqPatientPii,
                ubigeo: cqUbigeo
            })
            .from(cqPatients)
            .leftJoin(cqPatientPii, eq(cqPatients.id, cqPatientPii.patientId))
            .leftJoin(cqUbigeo, eq(cqPatients.ubigeo, cqUbigeo.code))
            .orderBy(cqPatients.createdAt);

        return result.map(r => ({
            ...r.patient,
            pii: r.pii,
            ubigeoData: r.ubigeo ? {
                code: r.ubigeo.code,
                distrito: r.ubigeo.distrito,
                provincia: r.ubigeo.provincia,
                departamento: r.ubigeo.departamento
            } : null
        })).reverse();
    } catch (error) {
        console.error("Error fetching patients:", error);
        return [];
    }
}

export async function createPaciente(formData: FormData) {
    const dni = formData.get("dni") as string;
    const carnetExtranjeria = formData.get("carnetExtranjeria") as string;
    const pasaporte = formData.get("pasaporte") as string;
    const nombres = formData.get("nombres") as string;
    const apellidos = formData.get("apellidos") as string;
    const sexo = formData.get("sexo") as string;
    const fechaNacimiento = formData.get("fechaNacimiento") as string;
    const historiaClinica = formData.get("historiaClinica") as string;
    const ubigeo = formData.get("ubigeo") as string;

    if (!nombres || !apellidos) {
        throw new Error("Nombres y apellidos son requeridos");
    }

    if (!dni && !carnetExtranjeria && !pasaporte) {
        throw new Error("Se requiere al menos un documento de identidad (DNI, C. Extranjería o Pasaporte/Otro)");
    }

    try {
        await db.transaction(async (tx) => {
            const [newPatient] = await tx.insert(cqPatients).values({
                sexo: sexo || null,
                fechaNacimiento: parseLocalDate(fechaNacimiento),
                ubigeo: ubigeo || null,
            }).returning();

            await tx.insert(cqPatientPii).values({
                patientId: newPatient.id,
                nombres: `${nombres.trim()} (TEMP)`,
                apellidos: apellidos.trim(),
                dni: dni || null,
                carnetExtranjeria: carnetExtranjeria || null,
                pasaporte: pasaporte || null,
                historiaClinica: historiaClinica || null
            });
        });

        revalidatePath("/dashboard/pacientes");
        revalidatePath("/dashboard/programaciones");
    } catch (error: any) {
        console.error("Error creating patient:", error);
        throw new Error("Error interno. Es probable que el DNI o HC ya existan.");
    }
}

export async function updatePaciente(id: string, formData: FormData) {
    const dni = formData.get("dni") as string;
    const carnetExtranjeria = formData.get("carnetExtranjeria") as string;
    const pasaporte = formData.get("pasaporte") as string;
    const nombres = formData.get("nombres") as string;
    const apellidos = formData.get("apellidos") as string;
    const sexo = formData.get("sexo") as string;
    const fechaNacimiento = formData.get("fechaNacimiento") as string;
    const historiaClinica = formData.get("historiaClinica") as string;
    const ubigeo = formData.get("ubigeo") as string;

    if (!nombres || !apellidos) {
        throw new Error("Nombres y apellidos son requeridos");
    }

    if (!dni && !carnetExtranjeria && !pasaporte) {
        throw new Error("Se requiere al menos un documento de identidad (DNI, C. Extranjería o Pasaporte/Otro)");
    }

    try {
        await db.transaction(async (tx) => {
            await tx.update(cqPatients).set({
                sexo: sexo || null,
                fechaNacimiento: parseLocalDate(fechaNacimiento),
                ubigeo: ubigeo || null,
                updatedAt: new Date()
            }).where(eq(cqPatients.id, id));

            await tx.update(cqPatientPii).set({
                nombres,
                apellidos,
                dni: dni || null,
                carnetExtranjeria: carnetExtranjeria || null,
                pasaporte: pasaporte || null,
                historiaClinica: historiaClinica || null
            }).where(eq(cqPatientPii.patientId, id));
        });

        revalidatePath("/dashboard/pacientes");
        revalidatePath("/dashboard/programaciones");
        return { success: true };
    } catch (error: any) {
        console.error("Error updating patient:", error);
        if (error.code === '23505') {
            return { success: false, message: "Ya existe otro paciente con este DNI o Historia Clínica." };
        }
        return { success: false, message: "Error interno al actualizar paciente" };
    }
}

export async function deletePaciente(id: string) {
    try {
        const historyCheck = await db.select().from(cqSurgeries).where(eq(cqSurgeries.patientId, id)).limit(1);

        if (historyCheck.length > 0) {
            return {
                success: false,
                message: "Imposible eliminar. El paciente tiene cirugías asociadas a su historia clínica."
            };
        }

        await db.delete(cqPatients).where(eq(cqPatients.id, id));

        revalidatePath("/dashboard/pacientes");
        revalidatePath("/dashboard/programaciones");
        return { success: true };
    } catch (error) {
        console.error("Error deleting patient:", error);
        return { success: false, message: "Error interno al intentar eliminar" };
    }
}

// ----------------------------------------------------
// ORPHAN PATIENT RESOLUTION (IDENTITY GOVERNANCE)
// ----------------------------------------------------

export async function getOrphans() {
    try {
        const result = await db
            .select({
                patient: cqPatients,
                pii: cqPatientPii
            })
            .from(cqPatients)
            .innerJoin(cqPatientPii, eq(cqPatients.id, cqPatientPii.patientId))
            .where(
                or(
                    eq(cqPatientPii.nombres, 'NO IDENTIFICADO'),
                    ilike(cqPatientPii.nombres, '%(TEMP)%')
                )
            )
            .orderBy(cqPatients.createdAt);

        return result.map(r => ({
            ...r.patient,
            pii: r.pii
        })).reverse();
    } catch (error) {
        console.error("Error fetching orphans:", error);
        return [];
    }
}

export async function syncOrphan(dni: string) {
    const apiUrl = process.env.API_NETHOS_URL;
    if (!apiUrl) return { success: false, message: "No API URL Configurada" };

    try {
        const response = await fetch(`${apiUrl}/api/pacientes/search?documento=${dni}`, { cache: 'no-store' });
        const data = await response.json();
        
        let externalPatientData = null;
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            externalPatientData = data.data[0]; 
        } else if (data.data && !Array.isArray(data.data) && data.data.nombres) {
            externalPatientData = data.data;
        }

        if (externalPatientData && (externalPatientData.nombres || externalPatientData.apellidoPaterno)) {
            let pName = (externalPatientData.nombres || "").trim() || "NO IDENTIFICADO";
            let pLastName = [
                (externalPatientData.apellidoPaterno || "").trim(),
                (externalPatientData.apellidoMaterno || "").trim()
            ].filter(Boolean).join(" ") || "NO IDENTIFICADO";
            
            let sexo = null;
            if (externalPatientData.sexo === "M" || externalPatientData.sexo === "Masculino") sexo = "Masculino";
            else if (externalPatientData.sexo === "F" || externalPatientData.sexo === "Femenino") sexo = "Femenino";
            
            let fechaNac = parseLocalDate(externalPatientData.fechaNacimiento);
            let pHistoriaClinica = (externalPatientData.observacion || "").trim() || dni;
            const rawUbi = externalPatientData.codigoInei || externalPatientData.ubigeoinei;
            let ubi = rawUbi ? rawUbi.toString().trim() : null;
            let pDireccion = (externalPatientData.direccion || "").trim() || null;

            const existingPii = await db.select().from(cqPatientPii).where(eq(cqPatientPii.dni, dni)).limit(1);
            if (existingPii.length > 0) {
                await db.update(cqPatients).set({
                    sexo: sexo,
                    fechaNacimiento: fechaNac,
                    ubigeo: ubi
                }).where(eq(cqPatients.id, existingPii[0].patientId));

                await db.update(cqPatientPii).set({
                    nombres: pName,
                    apellidos: pLastName,
                    historiaClinica: pHistoriaClinica,
                    direccion: pDireccion
                }).where(eq(cqPatientPii.patientId, existingPii[0].patientId));
                
                revalidatePath("/dashboard/pacientes/huerfanos");
                return { success: true, message: "¡Sincronización Mágica completada! Identidad recuperada de NetHos." };
            }
        }
        return { success: false, message: "La API aún no retorna datos funcionales para este documento." };
    } catch (e) {
        console.error("Error validando", e);
        return { success: false, message: "Error interno al contactar API" };
    }
}

export async function mergeOrphan(orphanPatientId: string, realDniToMergeWith: string) {
    try {
        // 1. Validar que el paciente huérfano exista
        const orphanPiiQuery = await db.select().from(cqPatientPii).where(eq(cqPatientPii.patientId, orphanPatientId)).limit(1);
        if (orphanPiiQuery.length === 0) return { success: false, message: "El paciente huérfano no existe." };

        // 2. Buscar el paciente REAL
        const realPiiQuery = await db.select().from(cqPatientPii).where(eq(cqPatientPii.dni, realDniToMergeWith)).limit(1);
        
        if (realPiiQuery.length > 0) {
            // ESCENARIO A: EL PACIENTE DESTINO YA EXISTE LOCALMENTE
            const realPatientId = realPiiQuery[0].patientId;
            if (realPatientId === orphanPatientId) return { success: false, message: "No puedes fusionar al paciente consigo mismo." };

            // 3. Reasignar todas las cirugías del huérfano al paciente real
            await db.update(cqSurgeries)
                .set({ patientId: realPatientId })
                .where(eq(cqSurgeries.patientId, orphanPatientId));

            // 4. Eliminar el huérfano (cascade borrará el registro PII)
            await db.delete(cqPatients).where(eq(cqPatients.id, orphanPatientId));

        } else {
            // ESCENARIO B: EL PACIENTE DESTINO NO EXISTE EN BACKCQ.
            // Primero consultamos directamente con NetHos si ese DNI es auténtico.
            const apiUrl = process.env.API_NETHOS_URL;
            let pFoundInApi = false;
            
            if (apiUrl) {
                try {
                    const response = await fetch(`${apiUrl}/api/pacientes/search?documento=${realDniToMergeWith}`, { cache: 'no-store' });
                    const data = await response.json();
                    
                    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                        pFoundInApi = true;
                    } else if (data.data && !Array.isArray(data.data) && data.data.nombres) {
                        pFoundInApi = true; // Por estructura variada del API NetHos
                    }
                } catch (e) {
                    console.error("Error conectando a API NetHos para Merge", e);
                }
            }

            if (!pFoundInApi) {
               return { success: false, message: `El DNI ${realDniToMergeWith} no existe en nuestro sistema ni en la base de datos central de NetHos. Búscalo o regístralo primero.` }; 
            }

            // Si NetHos tiene data, MUAMOS al paciente fantasma localmente
            // A que su nuevo Identidad provisoria sea el DNI Real.
            await db.update(cqPatientPii)
                .set({ dni: realDniToMergeWith, historiaClinica: realDniToMergeWith })
                .where(eq(cqPatientPii.patientId, orphanPatientId));

            // Hecho esto, como el paciente fantasma ahora tiene el DNI correcto, 
            // podemos lanzar la poderosa "Sincronización Mágica" programada anteriormente
            // para que se descargue sola toda la meta-data de NetHos encima del fantasma!
            await syncOrphan(realDniToMergeWith);
        }

        revalidatePath("/dashboard/pacientes");
        revalidatePath("/dashboard/pacientes/huerfanos");
        revalidatePath("/dashboard/programaciones");
        
        return { success: true, message: "¡Operación Magistral! Identidad mapeada y transferida con éxito hacia los datos maestros." };
    } catch (error) {
        console.error("Error merging orphans:", error);
        return { success: false, message: "Error crítico interno durante la fusión." };
    }
}
