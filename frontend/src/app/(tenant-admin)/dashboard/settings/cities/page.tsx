"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, Save } from "lucide-react";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useCities, City } from "@/hooks/useCities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function CitiesPage() {
    const { tenant } = useTenantAuth();
    const { cities, loading, addCity, deleteCity, toggleCity, updateCity } = useCities(tenant?.id || null);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [newCityName, setNewCityName] = useState("");
    const [editingCityId, setEditingCityId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleAddCity = async () => {
        if (!newCityName.trim()) return;
        setIsSaving(true);
        const success = await addCity(newCityName.trim());
        if (success) {
            setNewCityName("");
            setShowAddDialog(false);
        } else {
            alert("Failed to add city");
        }
        setIsSaving(false);
    };

    const handleDeleteCity = async (cityId: string) => {
        if (!confirm("Are you sure you want to delete this city?")) return;
        await deleteCity(cityId);
    };

    const handleToggleCity = async (cityId: string) => {
        const city = cities.find(c => c.id === cityId);
        if (city) await toggleCity(cityId, city.enabled);
    };

    const handleUpdateCityName = async (cityId: string, newName: string) => {
        await updateCity(cityId, { name: newName });
        setEditingCityId(null);
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading cities...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[#0F172A]">Service Cities</h1>
                    <p className="text-gray-500 text-sm">Manage cities where your services are available</p>
                </div>
                <Button
                    onClick={() => setShowAddDialog(true)}
                    className="bg-[#0F172A] hover:bg-[#1E293B] text-white"
                >
                    <Plus className="mr-2 h-4 w-4" /> Add City
                </Button>
            </div>

            <Card className="border-none shadow-sm bg-white">
                <CardHeader className="p-6 border-b">
                    <CardTitle className="text-lg font-bold text-[#0F172A]">Active Cities</CardTitle>
                    <CardDescription>Cities will appear in the dropdown on your estimate form</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    {cities.length > 0 ? (
                        <div className="space-y-3">
                            {cities.map((city) => (
                                <div
                                    key={city.id}
                                    className="flex items-center justify-between p-4 border rounded-lg hover:border-[#0F172A] transition-all group"
                                >
                                    {editingCityId === city.id ? (
                                        <Input
                                            autoFocus
                                            className="font-medium w-64"
                                            defaultValue={city.name}
                                            onBlur={(e) => handleUpdateCityName(city.id, e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleUpdateCityName(city.id, e.currentTarget.value);
                                                } else if (e.key === 'Escape') {
                                                    setEditingCityId(null);
                                                }
                                            }}
                                        />
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <span className="font-medium text-[#0F172A]">{city.name}</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600"
                                                onClick={() => setEditingCityId(city.id)}
                                            >
                                                <Pencil className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">
                                                {city.enabled ? "Enabled" : "Disabled"}
                                            </span>
                                            <button
                                                onClick={() => handleToggleCity(city.id)}
                                                className={cn(
                                                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                                                    city.enabled ? "bg-[#0F172A]" : "bg-gray-200"
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
                                                        city.enabled ? "translate-x-5" : "translate-x-0"
                                                    )}
                                                />
                                            </button>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteCity(city.id)}
                                            className="h-8 w-8 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-gray-400 mb-4">No cities added yet</p>
                            <Button
                                onClick={() => setShowAddDialog(true)}
                                variant="outline"
                            >
                                <Plus className="mr-2 h-4 w-4" /> Add Your First City
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add City Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New City</DialogTitle>
                        <DialogDescription>
                            Add a city where your services are available. It will appear in the estimate form dropdown.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>City Name</Label>
                            <Input
                                placeholder="e.g., Mumbai, Delhi, Bangalore"
                                value={newCityName}
                                onChange={(e) => setNewCityName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddCity();
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowAddDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddCity} disabled={isSaving || !newCityName.trim()}>
                            {isSaving ? "Adding..." : "Add City"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
