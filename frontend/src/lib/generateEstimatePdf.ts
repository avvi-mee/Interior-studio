import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getDb } from "@/lib/firebase";
import { getFirebaseStorage } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

interface EstimateData {
    customerInfo: {
        name: string;
        phone: string;
        email: string;
        city: string;
    };
    segment: 'Residential' | 'Commercial';
    plan: 'Basic' | 'Standard' | 'Luxe';
    carpetArea: number;
    bedrooms: number;
    bathrooms: number;
    configuration: {
        livingArea: { [itemId: string]: number };
        kitchen: {
            layout: string;
            material: string;
            items: { [itemId: string]: number };
        };
        bedrooms: Array<{ items: { [itemId: string]: number } }>;
        bathrooms: Array<{ items: { [itemId: string]: number } }>;
        cabins?: Array<{ items: { [itemId: string]: number } }>;
    };
    totalAmount: number;
    tenantId: string;
    createdAt: any;
}

export async function generateEstimatePDF(
    estimateId: string,
    companyName: string = "Interior Design Co.",
    options: { download?: boolean; uploadToStorage?: boolean; tenantId?: string } = { download: true, uploadToStorage: true }
): Promise<{ success: boolean; pdfUrl?: string }> {
    try {
        const db = getDb();

        // Find estimate in tenant's estimates collection
        let estimateData: EstimateData | null = null;

        if (options.tenantId) {
            const estimateRef = doc(db, `tenants/${options.tenantId}/estimates`, estimateId);
            const estimateSnap = await getDoc(estimateRef);

            if (estimateSnap.exists()) {
                const data = estimateSnap.data();
                estimateData = {
                    customerInfo: data.customer_info,
                    segment: data.project_summary?.segment,
                    plan: data.project_summary?.plan,
                    carpetArea: data.project_summary?.carpetArea,
                    bedrooms: data.project_summary?.bedrooms,
                    bathrooms: data.project_summary?.bathrooms,
                    configuration: data.project_summary?.configuration,
                    totalAmount: data.total_amount,
                    tenantId: data.tenant_id || options.tenantId,
                    createdAt: data.created_at,
                };
            }
        }

        if (!estimateData) {
            throw new Error("Estimate not found");
        }

        // Create PDF
        const pdf = new jsPDF();

        // Company Name Header
        pdf.setFontSize(20);
        pdf.setTextColor(15, 23, 42); // #0F172A
        pdf.text(companyName, 105, 20, { align: "center" });

        // Divider line
        pdf.setDrawColor(200, 200, 200);
        pdf.line(14, 25, 196, 25);

        // Title
        pdf.setFontSize(16);
        pdf.setTextColor(60, 60, 60);
        pdf.text("Interior Estimate Breakdown", 105, 35, { align: "center" });

        // Estimate Info
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Estimate ID: ${estimateId.slice(0, 12)}`, 14, 45);
        pdf.text(`Date: ${estimateData.createdAt ? new Date(estimateData.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}`, 14, 50);

        // Client Information Section
        pdf.setFontSize(12);
        pdf.setTextColor(15, 23, 42);
        pdf.text("Customer Information", 14, 62);

        pdf.setFontSize(10);
        pdf.setTextColor(80, 80, 80);
        pdf.text(`Name: ${estimateData.customerInfo.name}`, 14, 70);
        pdf.text(`Phone: ${estimateData.customerInfo.phone}`, 14, 76);
        pdf.text(`Email: ${estimateData.customerInfo.email}`, 14, 82);
        pdf.text(`City: ${estimateData.customerInfo.city}`, 14, 88);

        // Project Details Section
        pdf.setFontSize(12);
        pdf.setTextColor(15, 23, 42);
        pdf.text("Project Details", 14, 100);

        const projectDetails: any[] = [
            ['Segment', estimateData.segment],
            ['Plan Selected', estimateData.plan],
            ['Carpet Area', `${estimateData.carpetArea} sqft`]
        ];

        if (estimateData.segment === 'Residential') {
            projectDetails.push(['Bedrooms', estimateData.bedrooms?.toString() || '0']);
            projectDetails.push(['Bathrooms', estimateData.bathrooms?.toString() || '0']);
        } else {
            const cabinCount = estimateData.configuration.cabins?.length || 0;
            projectDetails.push(['No. of Cabins', cabinCount.toString()]);
            projectDetails.push(['Bathroom Units', estimateData.bathrooms?.toString() || '0']);
        }

        if (estimateData.configuration.kitchen.layout) {
            projectDetails.push(['Kitchen Layout', estimateData.configuration.kitchen.layout]);
        }
        if (estimateData.configuration.kitchen.material) {
            projectDetails.push(['Kitchen Material', estimateData.configuration.kitchen.material]);
        }

        autoTable(pdf, {
            startY: 105,
            head: [['Detail', 'Value']],
            body: projectDetails,
            theme: 'striped',
            headStyles: {
                fillColor: [15, 23, 42],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 10
            },
            bodyStyles: {
                textColor: [60, 60, 60],
                fontSize: 9
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            }
        });

        // Item Breakdown Section
        let currentY = (pdf as any).lastAutoTable.finalY + 10;

        pdf.setFontSize(12);
        pdf.setTextColor(15, 23, 42);
        pdf.text("Item Breakdown", 14, currentY);

        // Fetch pricing config to get item names
        const pricingRef = doc(db, `tenants/${estimateData.tenantId}/pricing/config`);
        const pricingSnap = await getDoc(pricingRef);
        const pricingConfig = pricingSnap.exists() ? pricingSnap.data() : null;

        const itemBreakdown: any[] = [];

        // Helper to get item name
        const getItemName = (categoryId: string, itemId: string) => {
            if (!pricingConfig?.categories) return itemId;
            const category = pricingConfig.categories.find((c: any) => c.id === categoryId);
            if (!category) return itemId;
            const item = category.items.find((i: any) => i.id === itemId);
            return item ? item.name : itemId;
        };

        // Living Area items
        if (estimateData.configuration.livingArea) {
            Object.entries(estimateData.configuration.livingArea).forEach(([itemId, quantity]) => {
                if (quantity > 0) {
                    itemBreakdown.push([
                        'Living Area',
                        getItemName('living_area', itemId),
                        quantity.toString()
                    ]);
                }
            });
        }

        // Kitchen items
        if (estimateData.configuration.kitchen.items) {
            Object.entries(estimateData.configuration.kitchen.items).forEach(([itemId, quantity]) => {
                if (quantity > 0) {
                    itemBreakdown.push([
                        'Kitchen',
                        getItemName('kitchen', itemId),
                        quantity.toString()
                    ]);
                }
            });
        }

        // Bedroom items
        if (estimateData.configuration.bedrooms) {
            estimateData.configuration.bedrooms.forEach((bedroom, index) => {
                Object.entries(bedroom.items).forEach(([itemId, quantity]) => {
                    if (quantity > 0) {
                        itemBreakdown.push([
                            `Bedroom ${index + 1}`,
                            getItemName('bedroom', itemId),
                            quantity.toString()
                        ]);
                    }
                });
            });
        }

        // Bathroom items
        if (estimateData.configuration.bathrooms) {
            estimateData.configuration.bathrooms.forEach((bathroom, index) => {
                Object.entries(bathroom.items).forEach(([itemId, quantity]) => {
                    if (quantity > 0) {
                        itemBreakdown.push([
                            estimateData!.segment === 'Commercial' ? `Bathroom Unit ${index + 1}` : `Bathroom ${index + 1}`,
                            getItemName(estimateData!.segment === 'Commercial' ? 'commercial_bathroom' : 'bathroom', itemId),
                            quantity.toString()
                        ]);
                    }
                });
            });
        }

        // Cabin items
        if (estimateData.configuration.cabins) {
            estimateData.configuration.cabins.forEach((cabin, index) => {
                Object.entries(cabin.items).forEach(([itemId, quantity]) => {
                    if (quantity > 0) {
                        itemBreakdown.push([
                            `Cabin ${index + 1}`,
                            getItemName('cabin', itemId),
                            quantity.toString()
                        ]);
                    }
                });
            });
        }

        if (itemBreakdown.length > 0) {
            autoTable(pdf, {
                startY: currentY + 5,
                head: [['Category', 'Item', 'Quantity']],
                body: itemBreakdown,
                theme: 'striped',
                headStyles: {
                    fillColor: [15, 23, 42],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 10
                },
                bodyStyles: {
                    textColor: [60, 60, 60],
                    fontSize: 9
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 252]
                }
            });

            currentY = (pdf as any).lastAutoTable.finalY + 15;
        }

        // Cost Summary Section
        pdf.setFontSize(12);
        pdf.setTextColor(15, 23, 42);
        pdf.text("Total Estimated Cost", 14, currentY);

        // Cost box with gradient effect
        pdf.setFillColor(37, 99, 235); // Blue-600
        pdf.roundedRect(14, currentY + 5, 182, 30, 3, 3, 'F');

        pdf.setFontSize(11);
        pdf.setTextColor(255, 255, 255);
        pdf.text("Total Amount:", 20, currentY + 18);

        pdf.setFontSize(22);
        pdf.setTextColor(255, 255, 255);
        pdf.text(`₹ ${estimateData.totalAmount.toLocaleString('en-IN')}`, 20, currentY + 30);

        pdf.setFontSize(9);
        pdf.setTextColor(255, 255, 255);
        pdf.text(`Plan: ${estimateData.plan}`, 150, currentY + 30);

        // Footer note
        pdf.setFontSize(8);
        pdf.setTextColor(120, 120, 120);
        pdf.text(
            "Note: This is an approximate estimate. Final quote may vary based on site conditions and material availability.",
            14,
            currentY + 45,
            { maxWidth: 180 }
        );

        // Footer
        pdf.setFontSize(7);
        pdf.setTextColor(150, 150, 150);
        pdf.text("Generated by Interior Estimation System", 105, 285, { align: "center" });

        // Generate filename
        const clientNameSlug = estimateData.customerInfo.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `estimate_${clientNameSlug}_${dateStr}.pdf`;

        let pdfUrl: string | undefined;

        // Upload to Firebase Storage if enabled
        if (options.uploadToStorage) {
            try {
                const storage = getFirebaseStorage();
                const pdfBlob = pdf.output("blob");
                const storagePath = `estimates/${estimateId}.pdf`;
                const storageRef = ref(storage, storagePath);

                await uploadBytes(storageRef, pdfBlob, {
                    contentType: "application/pdf",
                });

                pdfUrl = await getDownloadURL(storageRef);

                // Update the estimate record with pdfUrl
                const estimateDocRef = doc(db, `tenants/${estimateData.tenantId}/estimates`, estimateId);
                await updateDoc(estimateDocRef, { pdf_url: pdfUrl });
            } catch (uploadError) {
                console.error("Error uploading PDF to storage:", uploadError);
                // Continue with download even if upload fails
            }
        }

        // Download locally if enabled
        if (options.download) {
            pdf.save(filename);
        }

        return { success: true, pdfUrl };
    } catch (error) {
        console.error("Error generating PDF:", error);
        throw error;
    }
}
