"use server";

import { db } from "@/db";
import { cqSpecialties } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function getSpecialties() {
    return await db.select()
        .from(cqSpecialties)
        .where(eq(cqSpecialties.isActive, true))
        .orderBy(asc(cqSpecialties.name));
}
