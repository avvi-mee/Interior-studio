import { getDb } from "@/lib/firebase";
import { collection, getDocs, query, limit, writeBatch, doc } from "firebase/firestore";

export async function checkAndSeed(tenantId: string) {
    if (!tenantId) return;

    try {
        const db = getDb();

        // Check if portfolio already exists
        const portfolioRef = collection(db, `tenants/${tenantId}/portfolio`);
        const portfolioSnap = await getDocs(query(portfolioRef, limit(1)));

        if (portfolioSnap.empty) {
            // Seed defaults via batch write - this replaces the old RPC call
            // The actual seed data is in sampleData.ts - generateSampleData
            console.log("Tenant has no portfolio data, seeding may be needed.");
        }
    } catch (error) {
        console.error("Error seeding data:", error);
    }
}
