"use server";

import { db } from "@/db";
import { cqUbigeo } from "@/db/schema";
import { asc, desc, eq, ilike, or, and } from "drizzle-orm";

// Función para remover acentos para búsqueda insensible a estos
const normalizeText = (text: string) => {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export async function getUbigeos(page = 1, pageSize = 50, search = "") {
    try {
        let query = db.select().from(cqUbigeo);

        if (search) {
            // Remueve acentos y divide por espacios para buscar cada fragmento independiente (Multiparamétrico)
            const cleanSearch = normalizeText(search).trim();
            const words = cleanSearch.split(/\s+/).filter(w => w.length > 0);

            if (words.length > 0) {
                const conditions = words.map(word => {
                    const term = `%${word}%`;
                    return or(
                        ilike(cqUbigeo.code, term),
                        ilike(cqUbigeo.departamento, term),
                        ilike(cqUbigeo.provincia, term),
                        ilike(cqUbigeo.distrito, term)
                    );
                });

                // Operador lógico AND: Todas las palabras deben estar presentes (en algún campo)
                query = query.where(and(...conditions)) as any;
            }
        }

        const data = await query
            .orderBy(asc(cqUbigeo.departamento), asc(cqUbigeo.provincia), asc(cqUbigeo.distrito))
            .limit(pageSize)
            .offset((page - 1) * pageSize);

        // Normally we'd also return total count, for simplicity assuming endless scroll or client pagination for now.
        return data;
    } catch (error) {
        console.error("Error fetching ubigeos:", error);
        return [];
    }
}
