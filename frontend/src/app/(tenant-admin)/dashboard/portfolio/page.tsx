"use client";

import { useState, useRef } from "react";
import { Plus, Trash2, MapPin, Calendar, Image as ImageIcon, Loader2 } from "lucide-react";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePortfolio } from "@/hooks/usePortfolio";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { uploadImage } from "@/lib/storageHelpers";
import { useToast } from "@/hooks/use-toast";

export default function PortfolioPage() {
    const { tenant } = useTenantAuth();
    const { projects, loading, addProject, deleteProject } = usePortfolio(tenant?.id || null);
    const { toast } = useToast();

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        title: "",
        category: "Residential",
        location: "",
        completionDate: "",
        description: "",
    });
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>("");

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const resetForm = () => {
        setFormData({
            title: "",
            category: "Residential",
            location: "",
            completionDate: "",
            description: "",
        });
        setSelectedImage(null);
        setImagePreview("");
    };

    const handleSubmit = async () => {
        if (!formData.title.trim()) {
            toast({ title: "Title required", description: "Please enter a project title", variant: "destructive" });
            return;
        }
        if (!tenant?.id) {
            toast({ title: "Error", description: "Not authenticated. Please refresh the page.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);

        try {
            let imageUrl = "";

            // Upload image if selected
            if (selectedImage) {
                imageUrl = await uploadImage(selectedImage, tenant.id, "portfolio");
            }

            // Add Project to Firestore
            await addProject({
                title: formData.title.trim(),
                category: formData.category || "General",
                location: formData.location || "",
                completionDate: formData.completionDate || new Date().getFullYear().toString(),
                description: formData.description || "",
                images: imageUrl ? [imageUrl] : [],
            });

            toast({ title: "Success", description: "Project added to portfolio" });
            setIsAddDialogOpen(false);
            resetForm();

        } catch (error: any) {
            toast({
                title: "Error",
                description: error?.message || "Failed to add project. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this project?")) {
            try {
                await deleteProject(id);
                toast({ title: "Project deleted" });
            } catch {
                toast({ title: "Error", description: "Failed to delete project", variant: "destructive" });
            }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Portfolio</h1>
                    <p className="text-gray-500 text-sm">Manage projects showcased on your public website</p>
                </div>

                <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                    setIsAddDialogOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button className="bg-[#0F172A] hover:bg-[#1E293B] text-white">
                            <Plus className="mr-2 h-4 w-4" /> Add Project
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
                        <div className="bg-[#0F172A] px-6 py-4">
                            <DialogTitle className="text-white text-lg font-semibold">Add New Project</DialogTitle>
                            <p className="text-gray-400 text-sm mt-1">Add a project to showcase on your portfolio</p>
                        </div>

                        <div className="p-6 space-y-5">
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">
                                    Project Image
                                </Label>
                                <div
                                    className="relative aspect-video rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-gray-300 bg-gray-50 overflow-hidden transition-colors"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {imagePreview ? (
                                        <>
                                            <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                <p className="text-white text-sm font-medium">Click to change image</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <ImageIcon className="h-10 w-10 text-gray-300 mb-2" />
                                            <p className="text-sm text-gray-500 font-medium">Click to upload image</p>
                                            <p className="text-xs text-gray-400 mt-1">JPG, PNG up to 5MB</p>
                                        </>
                                    )}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageSelect}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">
                                        Project Title *
                                    </Label>
                                    <Input
                                        name="title"
                                        value={formData.title}
                                        onChange={handleInputChange}
                                        placeholder="Modern Apartment"
                                        className="border-gray-200"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">
                                        Category
                                    </Label>
                                    <Input
                                        name="category"
                                        value={formData.category}
                                        onChange={handleInputChange}
                                        placeholder="Residential"
                                        className="border-gray-200"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">
                                        Location
                                    </Label>
                                    <Input
                                        name="location"
                                        value={formData.location}
                                        onChange={handleInputChange}
                                        placeholder="New York, NY"
                                        className="border-gray-200"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">
                                        Completion Date
                                    </Label>
                                    <Input
                                        name="completionDate"
                                        value={formData.completionDate}
                                        onChange={handleInputChange}
                                        placeholder="Jan 2024"
                                        className="border-gray-200"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">
                                    Description
                                </Label>
                                <Textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    placeholder="Brief details about the project..."
                                    className="border-gray-200 min-h-[80px]"
                                />
                            </div>
                        </div>

                        <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setIsAddDialogOpen(false)}
                                disabled={isSubmitting}
                                className="border-gray-200"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="bg-[#0F172A] hover:bg-[#1E293B] text-white min-w-[120px]"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    "Save Project"
                                )}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {projects.map((project) => (
                    <Card key={project.id} className="group overflow-hidden border-none shadow-sm bg-white">
                        <div className="relative aspect-[4/3] bg-gray-100 flex items-center justify-center overflow-hidden">
                            {project.images?.[0] ? (
                                <img
                                    src={project.images[0]}
                                    alt={project.title}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                />
                            ) : (
                                <ImageIcon className="h-12 w-12 text-gray-300" />
                            )}

                            <div className="absolute top-3 right-3">
                                <Button
                                    size="icon"
                                    variant="destructive"
                                    className="h-8 w-8 bg-white/90 backdrop-blur shadow-sm hover:bg-red-50 text-red-500"
                                    onClick={() => handleDelete(project.id)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>

                            {project.category && (
                                <div className="absolute bottom-3 left-3">
                                    <Badge className="bg-white/90 backdrop-blur text-gray-700 uppercase text-[10px] font-bold px-2 py-0.5">
                                        {project.category}
                                    </Badge>
                                </div>
                            )}
                        </div>
                        <CardContent className="p-5">
                            <h3 className="font-bold text-gray-900">{project.title}</h3>
                            {(project.location || project.completionDate) && (
                                <div className="flex items-center text-xs text-gray-500 mt-2 space-x-3">
                                    {project.location && (
                                        <div className="flex items-center">
                                            <MapPin className="mr-1 h-3 w-3" /> {project.location}
                                        </div>
                                    )}
                                    {project.completionDate && (
                                        <div className="flex items-center">
                                            <Calendar className="mr-1 h-3 w-3" /> {project.completionDate}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}

                <div
                    className="border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center p-12 hover:border-gray-300 transition-colors cursor-pointer"
                    onClick={() => setIsAddDialogOpen(true)}
                >
                    <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                        <Plus className="h-5 w-5 text-gray-400" />
                    </div>
                    <p className="font-medium text-gray-900 text-sm">Add New Project</p>
                    <p className="text-xs text-gray-500 mt-1">Showcase your latest work</p>
                </div>
            </div>
        </div>
    );
}
