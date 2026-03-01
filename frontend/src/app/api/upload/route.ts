import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { verifyAuth } from "@/lib/firestoreServer";

export async function POST(req: NextRequest) {
    try {
        const { user, response } = await verifyAuth(req);
        if (!user) return response!;

        const formData = await req.formData();
        const file = formData.get("file") as File;
        const tenantId = formData.get("tenantId") as string;
        const rawFolder = (formData.get("folder") as string) || "general";
        const folder = rawFolder.replace(/[^a-z0-9_-]/gi, "").slice(0, 64) || "general";

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        if (!tenantId) {
            return NextResponse.json({ error: "Tenant ID is required" }, { status: 400 });
        }

        // Validate file type
        if (!file.type.startsWith("image/")) {
            return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
        }

        // Generate a unique filename
        const extension = file.name.split('.').pop();
        const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;

        // Define local storage path: public/uploads/[tenantId]/[folder]/[filename]
        const uploadDir = path.join(process.cwd(), "public", "uploads", tenantId, folder);

        // Ensure directory exists
        await mkdir(uploadDir, { recursive: true });

        // Convert File to Buffer and write to disk
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const filePath = path.join(uploadDir, filename);
        await writeFile(filePath, buffer);

        // Return the public URL
        const url = `/uploads/${tenantId}/${folder}/${filename}`;

        return NextResponse.json({ url });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({
            error: "Internal server error",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
