"use client";

import { useState, useEffect } from "react";
import {
    Plus,
    Save,
    Trash2,
    Pencil,
    ChevronUp,
    ChevronDown
} from "lucide-react";
import {
    usePricingConfig,
    PricingConfig,
    Category,
    PricingItem,
    DropdownOption,
    CarpetAreaSettings,
    CalculationRules,
    RateSlab,
    AdditionalCharge
} from "@/hooks/usePricingConfig";
import { CityManagement } from "@/components/dashboard/CityManagement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// --- Sub-components for better organization ---

interface CategoryCardProps {
    category: Category;
    catIndex: number;
    totalInGroup: number;
    moveCategoryUp: (id: string) => void;
    moveCategoryDown: (id: string) => void;
    editingCategoryId: string | null;
    setEditingCategoryId: (id: string | null) => void;
    updateCategoryName: (id: string, name: string) => void;
    deleteCategory: (id: string) => void;
    setSelectedCategoryForItem: (id: string) => void;
    setShowAddItem: (show: boolean) => void;
    editingItemId: string | null;
    setEditingItemId: (id: string | null) => void;
    updateItem: (catId: string, itemId: string, updates: Partial<PricingItem>) => void;
    toggleItem: (catId: string, itemId: string) => void;
    deleteItem: (catId: string, itemId: string) => void;
}

const CategoryCard = ({
    category, catIndex, totalInGroup,
    moveCategoryUp, moveCategoryDown,
    editingCategoryId, setEditingCategoryId, updateCategoryName, deleteCategory,
    setSelectedCategoryForItem, setShowAddItem,
    editingItemId, setEditingItemId, updateItem, toggleItem, deleteItem
}: CategoryCardProps) => {
    return (
        <div key={category.id} className="border rounded-xl p-6 space-y-6 hover:shadow-md transition-shadow group/card bg-white">
            {/* Category Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 p-0 hover:bg-slate-100"
                            onClick={() => moveCategoryUp(category.id)}
                            disabled={catIndex === 0}
                        >
                            <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 p-0 hover:bg-slate-100"
                            onClick={() => moveCategoryDown(category.id)}
                            disabled={catIndex === totalInGroup - 1}
                        >
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                    </div>
                    {editingCategoryId === category.id ? (
                        <div className="flex items-center gap-2">
                            <Input
                                autoFocus
                                className="font-bold text-xl w-72 h-10"
                                defaultValue={category.name}
                                onBlur={(e) => updateCategoryName(category.id, e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') updateCategoryName(category.id, e.currentTarget.value);
                                    else if (e.key === 'Escape') setEditingCategoryId(null);
                                }}
                            />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-xl text-[#0F172A]">{category.name}</h3>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-400 hover:text-blue-600 opacity-0 group-hover/card:opacity-100 transition-opacity"
                                onClick={() => setEditingCategoryId(category.id)}
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSelectedCategoryForItem(category.id);
                            setShowAddItem(true);
                        }}
                        className="text-blue-600 border-blue-100 hover:bg-blue-50 h-9"
                    >
                        <Plus className="h-4 w-4 mr-1" /> Add Item
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteCategory(category.id)}
                        className="h-9 w-9 text-gray-400 hover:text-red-600 hover:bg-red-50"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Items Table */}
            {category.items.length > 0 ? (
                <div className="overflow-hidden border rounded-lg">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b">
                                <th className="text-left p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[25%]">Item Name</th>
                                <th className="text-center p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[12%]">Type</th>
                                <th className="text-right p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[15%]">Basic (₹)</th>
                                <th className="text-right p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[15%]">Standard (₹)</th>
                                <th className="text-right p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[15%]">Luxe (₹)</th>
                                <th className="text-center p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[8%]">Status</th>
                                <th className="text-center p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[10%]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {category.items.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group/item">
                                    <td className="p-4">
                                        {editingItemId === item.id ? (
                                            <Input
                                                autoFocus
                                                className="h-8 text-sm"
                                                defaultValue={item.name}
                                                onBlur={(e) => {
                                                    updateItem(category.id, item.id, { name: e.target.value });
                                                    setEditingItemId(null);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        updateItem(category.id, item.id, { name: e.currentTarget.value });
                                                        setEditingItemId(null);
                                                    } else if (e.key === 'Escape') {
                                                        setEditingItemId(null);
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-slate-700">{item.name}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-blue-600 transition-opacity"
                                                    onClick={() => setEditingItemId(item.id)}
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-center">
                                        <Select
                                            value={item.type}
                                            onValueChange={(value: 'fixed' | 'perUnit' | 'perSqft') =>
                                                updateItem(category.id, item.id, { type: value })
                                            }
                                        >
                                            <SelectTrigger className="w-full h-8 text-[11px] font-medium bg-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="fixed">Fixed</SelectItem>
                                                <SelectItem value="perUnit">Per Unit</SelectItem>
                                                <SelectItem value="perSqft">Per Sqft</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="p-4 text-right">
                                        <Input
                                            type="number"
                                            className="text-right h-8 w-full text-sm bg-white"
                                            value={item.basicPrice}
                                            onChange={(e) =>
                                                updateItem(category.id, item.id, { basicPrice: parseInt(e.target.value) || 0 })
                                            }
                                        />
                                    </td>
                                    <td className="p-4 text-right">
                                        <Input
                                            type="number"
                                            className="text-right h-8 w-full text-sm font-medium bg-slate-50 border-slate-200"
                                            value={item.standardPrice}
                                            onChange={(e) =>
                                                updateItem(category.id, item.id, { standardPrice: parseInt(e.target.value) || 0 })
                                            }
                                        />
                                    </td>
                                    <td className="p-4 text-right">
                                        <Input
                                            type="number"
                                            className="text-right h-8 w-full text-sm bg-white"
                                            value={item.luxePrice}
                                            onChange={(e) =>
                                                updateItem(category.id, item.id, { luxePrice: parseInt(e.target.value) || 0 })
                                            }
                                        />
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => toggleItem(category.id, item.id)}
                                            className={cn(
                                                "relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors shadow-inner",
                                                item.enabled ? "bg-emerald-500" : "bg-slate-200"
                                            )}
                                        >
                                            <span className={cn(
                                                "pointer-events-none block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform",
                                                item.enabled ? "translate-x-5" : "translate-x-0"
                                            )} />
                                        </button>
                                    </td>
                                    <td className="p-4 text-center">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => deleteItem(category.id, item.id)}
                                            className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center py-10 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                    <p className="text-sm text-slate-400">No items added yet. Click &quot;Add Item&quot; to start building this category.</p>
                </div>
            )}
        </div>
    );
};

// --- Main PricingConfigEditor Component ---

interface PricingConfigEditorProps {
    tenantId: string;
}

export default function PricingConfigEditor({ tenantId }: PricingConfigEditorProps) {
    const { config, loading, saveConfig } = usePricingConfig(tenantId);
    const [localConfig, setLocalConfig] = useState<PricingConfig | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Dialog states
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [showAddItem, setShowAddItem] = useState(false);
    const [showAddKitchenLayout, setShowAddKitchenLayout] = useState(false);
    const [showAddKitchenMaterial, setShowAddKitchenMaterial] = useState(false);

    // Form states
    const [newCategoryName, setNewCategoryName] = useState("");
    const [newCategoryType, setNewCategoryType] = useState<'residential' | 'commercial'>('residential');
    const [selectedCategoryForItem, setSelectedCategoryForItem] = useState("");
    const [newItemName, setNewItemName] = useState("");
    const [newItemType, setNewItemType] = useState<'fixed' | 'perUnit' | 'perSqft'>('fixed');
    const [newItemBasicPrice, setNewItemBasicPrice] = useState("");
    const [newItemStandardPrice, setNewItemStandardPrice] = useState("");
    const [newItemLuxePrice, setNewItemLuxePrice] = useState("");
    const [newItemDefaultQuantity, setNewItemDefaultQuantity] = useState("");
    const [newItemPlanVisibility, setNewItemPlanVisibility] = useState<('Basic' | 'Standard' | 'Luxe')[]>([]);
    const [newKitchenLayoutName, setNewKitchenLayoutName] = useState("");
    const [newKitchenMaterialName, setNewKitchenMaterialName] = useState("");

    // Edit states
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editingLayoutId, setEditingLayoutId] = useState<string | null>(null);
    const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);

    useEffect(() => {
        if (config) {
            setLocalConfig(JSON.parse(JSON.stringify(config)));
        }
    }, [config]);

    const handleSave = async () => {
        if (!localConfig) return;
        setIsSaving(true);
        const success = await saveConfig(localConfig);
        if (success) {
            alert("✅ Pricing configuration saved successfully!");
        } else {
            alert("❌ Failed to save pricing configuration");
        }
        setIsSaving(false);
    };

    // Category Management
    const addCategory = async () => {
        if (!localConfig || !newCategoryName) return;
        const newCategory: Category = {
            id: `cat_${Date.now()}`,
            name: newCategoryName,
            type: newCategoryType,
            order: localConfig.categories?.length || 0,
            items: []
        };
        const updatedConfig = {
            ...localConfig,
            categories: [...(localConfig.categories || []), newCategory]
        };
        setLocalConfig(updatedConfig);
        await saveConfig(updatedConfig);
        setNewCategoryName("");
        setShowAddCategory(false);
    };

    const deleteCategory = async (categoryId: string) => {
        if (!localConfig) return;
        if (!confirm("Are you sure you want to delete this category and all its items?")) return;
        const updatedConfig = {
            ...localConfig,
            categories: localConfig.categories?.filter(c => c.id !== categoryId)
        };
        setLocalConfig(updatedConfig);
        await saveConfig(updatedConfig);
    };

    const updateCategoryName = (categoryId: string, newName: string) => {
        if (!localConfig) return;
        const updatedConfig = {
            ...localConfig,
            categories: localConfig.categories?.map(c =>
                c.id === categoryId ? { ...c, name: newName } : c
            )
        };
        setLocalConfig(updatedConfig);
        saveConfig(updatedConfig);
        setEditingCategoryId(null);
    };

    const moveCategoryUp = (categoryId: string) => {
        if (!localConfig?.categories) return;

        const category = localConfig.categories.find(c => c.id === categoryId);
        if (!category) return;

        const sameTypeCategories = localConfig.categories
            .filter(c => (!category.type && !c.type) || c.type === category.type)
            .sort((a, b) => a.order - b.order);

        const indexInSameType = sameTypeCategories.findIndex(c => c.id === categoryId);
        if (indexInSameType <= 0) return;

        const categoryAbove = sameTypeCategories[indexInSameType - 1];

        const updatedCategories = localConfig.categories.map(c => {
            if (c.id === categoryId) return { ...c, order: categoryAbove.order };
            if (c.id === categoryAbove.id) return { ...c, order: category.order };
            return c;
        });

        const updatedConfig = { ...localConfig, categories: updatedCategories };
        setLocalConfig(updatedConfig);
        saveConfig(updatedConfig);
    };

    const moveCategoryDown = (categoryId: string) => {
        if (!localConfig?.categories) return;

        const category = localConfig.categories.find(c => c.id === categoryId);
        if (!category) return;

        const sameTypeCategories = localConfig.categories
            .filter(c => (!category.type && !c.type) || c.type === category.type)
            .sort((a, b) => a.order - b.order);

        const indexInSameType = sameTypeCategories.findIndex(c => c.id === categoryId);
        if (indexInSameType < 0 || indexInSameType >= sameTypeCategories.length - 1) return;

        const categoryBelow = sameTypeCategories[indexInSameType + 1];

        const updatedCategories = localConfig.categories.map(c => {
            if (c.id === categoryId) return { ...c, order: categoryBelow.order };
            if (c.id === categoryBelow.id) return { ...c, order: category.order };
            return c;
        });

        const updatedConfig = { ...localConfig, categories: updatedCategories };
        setLocalConfig(updatedConfig);
        saveConfig(updatedConfig);
    };

    // Item Management
    const addItem = async () => {
        if (!localConfig || !selectedCategoryForItem) return;

        if (!newItemName.trim()) {
            alert("Please enter an item name");
            return;
        }
        if (!newItemBasicPrice || !newItemStandardPrice || !newItemLuxePrice) {
            alert("Please enter all prices");
            return;
        }

        const newItem: PricingItem = {
            id: `item_${Date.now()}`,
            name: newItemName,
            type: newItemType,
            basicPrice: parseInt(newItemBasicPrice),
            standardPrice: parseInt(newItemStandardPrice),
            luxePrice: parseInt(newItemLuxePrice),
            enabled: true,
            ...(newItemDefaultQuantity ? { defaultQuantity: parseInt(newItemDefaultQuantity) } : {}),
            ...(newItemPlanVisibility.length > 0 && newItemPlanVisibility.length < 3 ? { planVisibility: newItemPlanVisibility } : {}),
        };

        const updatedConfig = {
            ...localConfig,
            categories: localConfig.categories?.map(cat =>
                cat.id === selectedCategoryForItem
                    ? { ...cat, items: [...cat.items, newItem] }
                    : cat
            )
        };

        setLocalConfig(updatedConfig);
        await saveConfig(updatedConfig);

        setNewItemName("");
        setNewItemBasicPrice("");
        setNewItemStandardPrice("");
        setNewItemLuxePrice("");
        setNewItemDefaultQuantity("");
        setNewItemPlanVisibility([]);
        setShowAddItem(false);
    };

    const deleteItem = async (categoryId: string, itemId: string) => {
        if (!localConfig) return;
        const updatedConfig = {
            ...localConfig,
            categories: localConfig.categories?.map(cat =>
                cat.id === categoryId
                    ? { ...cat, items: cat.items.filter(i => i.id !== itemId) }
                    : cat
            )
        };
        setLocalConfig(updatedConfig);
        await saveConfig(updatedConfig);
    };

    const updateItem = async (categoryId: string, itemId: string, updates: Partial<PricingItem>) => {
        if (!localConfig) return;
        const updatedConfig = {
            ...localConfig,
            categories: localConfig.categories?.map(cat =>
                cat.id === categoryId
                    ? {
                        ...cat,
                        items: cat.items.map(item =>
                            item.id === itemId ? { ...item, ...updates } : item
                        )
                    }
                    : cat
            )
        };
        setLocalConfig(updatedConfig);
        await saveConfig(updatedConfig);
    };

    const toggleItem = async (categoryId: string, itemId: string) => {
        if (!localConfig) return;
        const updatedConfig = {
            ...localConfig,
            categories: localConfig.categories?.map(cat =>
                cat.id === categoryId
                    ? {
                        ...cat,
                        items: cat.items.map(item =>
                            item.id === itemId ? { ...item, enabled: !item.enabled } : item
                        )
                    }
                    : cat
            )
        };
        setLocalConfig(updatedConfig);
        await saveConfig(updatedConfig);
    };

    // Kitchen Dropdown Management
    const addKitchenLayout = async () => {
        if (!localConfig || !newKitchenLayoutName) return;
        const newLayout: DropdownOption = {
            id: `kl_${Date.now()}`,
            name: newKitchenLayoutName,
            enabled: true
        };
        const updatedConfig = {
            ...localConfig,
            kitchenLayouts: [...(localConfig.kitchenLayouts || []), newLayout]
        };
        setLocalConfig(updatedConfig);
        await saveConfig(updatedConfig);
        setNewKitchenLayoutName("");
        setShowAddKitchenLayout(false);
    };

    const deleteKitchenLayout = async (layoutId: string) => {
        if (!localConfig) return;
        const updatedConfig = {
            ...localConfig,
            kitchenLayouts: localConfig.kitchenLayouts?.filter(l => l.id !== layoutId)
        };
        setLocalConfig(updatedConfig);
        await saveConfig(updatedConfig);
    };

    const updateKitchenLayout = async (layoutId: string, name: string) => {
        if (!localConfig) return;
        const updatedConfig = {
            ...localConfig,
            kitchenLayouts: localConfig.kitchenLayouts?.map(l =>
                l.id === layoutId ? { ...l, name } : l
            )
        };
        setLocalConfig(updatedConfig);
        await saveConfig(updatedConfig);
        setEditingLayoutId(null);
    };

    const toggleKitchenLayout = async (layoutId: string) => {
        if (!localConfig) return;
        const updatedConfig = {
            ...localConfig,
            kitchenLayouts: localConfig.kitchenLayouts?.map(l =>
                l.id === layoutId ? { ...l, enabled: !l.enabled } : l
            )
        };
        setLocalConfig(updatedConfig);
        await saveConfig(updatedConfig);
    };

    const addKitchenMaterial = async () => {
        if (!localConfig || !newKitchenMaterialName) return;
        const newMaterial: DropdownOption = {
            id: `km_${Date.now()}`,
            name: newKitchenMaterialName,
            enabled: true
        };
        const updatedConfig = {
            ...localConfig,
            kitchenMaterials: [...(localConfig.kitchenMaterials || []), newMaterial]
        };
        setLocalConfig(updatedConfig);
        await saveConfig(updatedConfig);
        setNewKitchenMaterialName("");
        setShowAddKitchenMaterial(false);
    };

    const deleteKitchenMaterial = async (materialId: string) => {
        if (!localConfig) return;
        const updatedConfig = {
            ...localConfig,
            kitchenMaterials: localConfig.kitchenMaterials?.filter(m => m.id !== materialId)
        };
        setLocalConfig(updatedConfig);
        await saveConfig(updatedConfig);
    };

    const updateKitchenMaterial = async (materialId: string, name: string) => {
        if (!localConfig) return;
        const updatedConfig = {
            ...localConfig,
            kitchenMaterials: localConfig.kitchenMaterials?.map(m =>
                m.id === materialId ? { ...m, name } : m
            )
        };
        setLocalConfig(updatedConfig);
        await saveConfig(updatedConfig);
        setEditingMaterialId(null);
    };

    const toggleKitchenMaterial = async (materialId: string) => {
        if (!localConfig) return;
        const updatedConfig = {
            ...localConfig,
            kitchenMaterials: localConfig.kitchenMaterials?.map(m =>
                m.id === materialId ? { ...m, enabled: !m.enabled } : m
            )
        };
        setLocalConfig(updatedConfig);
        await saveConfig(updatedConfig);
    };

    if (loading || !localConfig) {
        return <div className="p-8 text-center text-gray-500">Loading pricing configuration...</div>;
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <p className="text-gray-500 text-sm">Manage three-tier pricing (Basic / Standard / Luxe) for all items</p>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                        v{localConfig.version || 1}
                    </span>
                </div>
                <div className="flex items-center space-x-4">
                    {config?.lastUpdated && (
                        <p className="text-[10px] text-gray-400 uppercase font-bold">
                            Last Updated: {config.lastUpdated?.toDate ? config.lastUpdated.toDate().toLocaleString() : "Not saved yet"}
                        </p>
                    )}
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-[#0F172A] hover:bg-[#1E293B] text-white px-6 py-4 rounded-md flex items-center"
                    >
                        <Save className="mr-2 h-4 w-4" /> {isSaving ? "Saving..." : "Save All Changes"}
                    </Button>
                </div>
            </div>

            {/* City Management Section */}
            <CityManagement tenantId={tenantId} />

            {/* Categories Section */}
            <div className="space-y-8">
                {/* Residential Column */}
                <Card className="border-none shadow-sm bg-white overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between p-6 border-b bg-slate-50">
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-1 bg-orange-500 rounded-full"></div>
                            <CardTitle className="text-lg font-bold text-[#0F172A]">Residential Categories</CardTitle>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setNewCategoryType('residential');
                                setShowAddCategory(true);
                            }}
                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                        >
                            <Plus className="h-4 w-4 mr-1" /> Add Residential Category
                        </Button>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        {localConfig.categories?.filter(c => !c.type || c.type === 'residential').sort((a, b) => a.order - b.order).map((category, catIndex, filteredArr) => (
                            <CategoryCard
                                key={category.id}
                                category={category}
                                catIndex={catIndex}
                                totalInGroup={filteredArr.length}
                                moveCategoryUp={moveCategoryUp}
                                moveCategoryDown={moveCategoryDown}
                                editingCategoryId={editingCategoryId}
                                setEditingCategoryId={setEditingCategoryId}
                                updateCategoryName={updateCategoryName}
                                deleteCategory={deleteCategory}
                                setSelectedCategoryForItem={setSelectedCategoryForItem}
                                setShowAddItem={setShowAddItem}
                                editingItemId={editingItemId}
                                setEditingItemId={setEditingItemId}
                                updateItem={updateItem}
                                toggleItem={toggleItem}
                                deleteItem={deleteItem}
                            />
                        ))}
                        {(!localConfig.categories?.some(c => !c.type || c.type === 'residential')) && (
                            <p className="text-center text-gray-400 py-8">No residential categories yet.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Commercial Column */}
                <Card className="border-none shadow-sm bg-white overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between p-6 border-b bg-slate-50">
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-1 bg-blue-500 rounded-full"></div>
                            <CardTitle className="text-lg font-bold text-[#0F172A]">Commercial Categories</CardTitle>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setNewCategoryType('commercial');
                                setShowAddCategory(true);
                            }}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                            <Plus className="h-4 w-4 mr-1" /> Add Commercial Category
                        </Button>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        {localConfig.categories?.filter(c => c.type === 'commercial').sort((a, b) => a.order - b.order).map((category, catIndex, filteredArr) => (
                            <CategoryCard
                                key={category.id}
                                category={category}
                                catIndex={catIndex}
                                totalInGroup={filteredArr.length}
                                moveCategoryUp={moveCategoryUp}
                                moveCategoryDown={moveCategoryDown}
                                editingCategoryId={editingCategoryId}
                                setEditingCategoryId={setEditingCategoryId}
                                updateCategoryName={updateCategoryName}
                                deleteCategory={deleteCategory}
                                setSelectedCategoryForItem={setSelectedCategoryForItem}
                                setShowAddItem={setShowAddItem}
                                editingItemId={editingItemId}
                                setEditingItemId={setEditingItemId}
                                updateItem={updateItem}
                                toggleItem={toggleItem}
                                deleteItem={deleteItem}
                            />
                        ))}
                        {(!localConfig.categories?.some(c => c.type === 'commercial')) && (
                            <p className="text-center text-gray-400 py-8">No commercial categories yet.</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Kitchen Dropdowns Section */}
            <div className="grid grid-cols-2 gap-6">
                {/* Kitchen Layouts */}
                <Card className="border-none shadow-sm bg-white">
                    <CardHeader className="flex flex-row items-center justify-between p-6 border-b">
                        <CardTitle className="text-lg font-bold text-[#0F172A]">Kitchen Layouts</CardTitle>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAddKitchenLayout(true)}
                            className="text-blue-600 hover:text-blue-700"
                        >
                            <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                    </CardHeader>
                    <CardContent className="p-6 space-y-3">
                        {localConfig.kitchenLayouts?.map((layout) => (
                            <div key={layout.id} className="flex items-center justify-between p-3 border rounded-lg hover:border-[#0F172A] transition-all group">
                                {editingLayoutId === layout.id ? (
                                    <Input
                                        autoFocus
                                        className="text-sm font-medium"
                                        defaultValue={layout.name}
                                        onBlur={(e) => updateKitchenLayout(layout.id, e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') updateKitchenLayout(layout.id, e.currentTarget.value);
                                            else if (e.key === 'Escape') setEditingLayoutId(null);
                                        }}
                                    />
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{layout.name}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600"
                                            onClick={() => setEditingLayoutId(layout.id)}
                                        >
                                            <Pencil className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => toggleKitchenLayout(layout.id)}
                                        className={cn(
                                            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                                            layout.enabled ? "bg-[#0F172A]" : "bg-gray-200"
                                        )}
                                    >
                                        <span className={cn(
                                            "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
                                            layout.enabled ? "translate-x-5" : "translate-x-0"
                                        )} />
                                    </button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => deleteKitchenLayout(layout.id)}
                                        className="h-8 w-8 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Kitchen Materials */}
                <Card className="border-none shadow-sm bg-white">
                    <CardHeader className="flex flex-row items-center justify-between p-6 border-b">
                        <CardTitle className="text-lg font-bold text-[#0F172A]">Kitchen Materials</CardTitle>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAddKitchenMaterial(true)}
                            className="text-blue-600 hover:text-blue-700"
                        >
                            <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                    </CardHeader>
                    <CardContent className="p-6 space-y-3">
                        {localConfig.kitchenMaterials?.map((material) => (
                            <div key={material.id} className="flex items-center justify-between p-3 border rounded-lg hover:border-[#0F172A] transition-all group">
                                {editingMaterialId === material.id ? (
                                    <Input
                                        autoFocus
                                        className="text-sm font-medium"
                                        defaultValue={material.name}
                                        onBlur={(e) => updateKitchenMaterial(material.id, e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') updateKitchenMaterial(material.id, e.currentTarget.value);
                                            else if (e.key === 'Escape') setEditingMaterialId(null);
                                        }}
                                    />
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{material.name}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600"
                                            onClick={() => setEditingMaterialId(material.id)}
                                        >
                                            <Pencil className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => toggleKitchenMaterial(material.id)}
                                        className={cn(
                                            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                                            material.enabled ? "bg-[#0F172A]" : "bg-gray-200"
                                        )}
                                    >
                                        <span className={cn(
                                            "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
                                            material.enabled ? "translate-x-5" : "translate-x-0"
                                        )} />
                                    </button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => deleteKitchenMaterial(material.id)}
                                        className="h-8 w-8 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            {/* Carpet Area Settings */}
            <Card className="border-none shadow-sm bg-white overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between p-6 border-b bg-slate-50">
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-1 bg-green-500 rounded-full"></div>
                        <CardTitle className="text-lg font-bold text-[#0F172A]">Carpet Area Settings</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-slate-500">Min Sqft</Label>
                            <Input
                                type="number"
                                value={localConfig.carpetAreaSettings?.minSqft ?? 200}
                                onChange={(e) => setLocalConfig({
                                    ...localConfig,
                                    carpetAreaSettings: {
                                        ...localConfig.carpetAreaSettings || { minSqft: 200, maxSqft: 10000 },
                                        minSqft: parseInt(e.target.value) || 0
                                    }
                                })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-slate-500">Max Sqft</Label>
                            <Input
                                type="number"
                                value={localConfig.carpetAreaSettings?.maxSqft ?? 10000}
                                onChange={(e) => setLocalConfig({
                                    ...localConfig,
                                    carpetAreaSettings: {
                                        ...localConfig.carpetAreaSettings || { minSqft: 200, maxSqft: 10000 },
                                        maxSqft: parseInt(e.target.value) || 0
                                    }
                                })}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-slate-500">Base Price Per Sqft (optional)</Label>
                        <Input
                            type="number"
                            placeholder="0"
                            value={localConfig.carpetAreaSettings?.basePricePerSqft ?? ""}
                            onChange={(e) => setLocalConfig({
                                ...localConfig,
                                carpetAreaSettings: {
                                    ...localConfig.carpetAreaSettings || { minSqft: 200, maxSqft: 10000 },
                                    basePricePerSqft: e.target.value ? parseInt(e.target.value) : undefined
                                }
                            })}
                        />
                        <p className="text-xs text-slate-400">Flat base cost added per sqft to the estimate</p>
                    </div>

                    {/* Rate Slabs */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold uppercase text-slate-500">Rate Slabs (optional)</Label>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600 hover:text-green-700"
                                onClick={() => {
                                    const slabs = localConfig.carpetAreaSettings?.rateSlabs || [];
                                    setLocalConfig({
                                        ...localConfig,
                                        carpetAreaSettings: {
                                            ...localConfig.carpetAreaSettings || { minSqft: 200, maxSqft: 10000 },
                                            rateSlabs: [...slabs, { id: `slab_${Date.now()}`, minSqft: 0, maxSqft: 0, multiplier: 1, label: '' }]
                                        }
                                    });
                                }}
                            >
                                <Plus className="h-4 w-4 mr-1" /> Add Slab
                            </Button>
                        </div>
                        {(localConfig.carpetAreaSettings?.rateSlabs || []).map((slab, idx) => (
                            <div key={slab.id} className="grid grid-cols-5 gap-3 items-end border rounded-lg p-3">
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-slate-400">Min Sqft</Label>
                                    <Input
                                        type="number"
                                        className="h-8 text-sm"
                                        value={slab.minSqft}
                                        onChange={(e) => {
                                            const slabs = [...(localConfig.carpetAreaSettings?.rateSlabs || [])];
                                            slabs[idx] = { ...slabs[idx], minSqft: parseInt(e.target.value) || 0 };
                                            setLocalConfig({
                                                ...localConfig,
                                                carpetAreaSettings: { ...localConfig.carpetAreaSettings!, rateSlabs: slabs }
                                            });
                                        }}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-slate-400">Max Sqft</Label>
                                    <Input
                                        type="number"
                                        className="h-8 text-sm"
                                        value={slab.maxSqft}
                                        onChange={(e) => {
                                            const slabs = [...(localConfig.carpetAreaSettings?.rateSlabs || [])];
                                            slabs[idx] = { ...slabs[idx], maxSqft: parseInt(e.target.value) || 0 };
                                            setLocalConfig({
                                                ...localConfig,
                                                carpetAreaSettings: { ...localConfig.carpetAreaSettings!, rateSlabs: slabs }
                                            });
                                        }}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-slate-400">Multiplier</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        className="h-8 text-sm"
                                        value={slab.multiplier}
                                        onChange={(e) => {
                                            const slabs = [...(localConfig.carpetAreaSettings?.rateSlabs || [])];
                                            slabs[idx] = { ...slabs[idx], multiplier: parseFloat(e.target.value) || 1 };
                                            setLocalConfig({
                                                ...localConfig,
                                                carpetAreaSettings: { ...localConfig.carpetAreaSettings!, rateSlabs: slabs }
                                            });
                                        }}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-slate-400">Label</Label>
                                    <Input
                                        className="h-8 text-sm"
                                        placeholder="e.g. 500-1000 sqft"
                                        value={slab.label || ''}
                                        onChange={(e) => {
                                            const slabs = [...(localConfig.carpetAreaSettings?.rateSlabs || [])];
                                            slabs[idx] = { ...slabs[idx], label: e.target.value };
                                            setLocalConfig({
                                                ...localConfig,
                                                carpetAreaSettings: { ...localConfig.carpetAreaSettings!, rateSlabs: slabs }
                                            });
                                        }}
                                    />
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => {
                                        const slabs = (localConfig.carpetAreaSettings?.rateSlabs || []).filter(s => s.id !== slab.id);
                                        setLocalConfig({
                                            ...localConfig,
                                            carpetAreaSettings: { ...localConfig.carpetAreaSettings!, rateSlabs: slabs }
                                        });
                                    }}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                        <p className="text-xs text-slate-400">Multiplier is applied to (items subtotal + base price). E.g., 0.95 = 5% discount for that slab range.</p>
                    </div>
                </CardContent>
            </Card>

            {/* Calculation Rules */}
            <Card className="border-none shadow-sm bg-white overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between p-6 border-b bg-slate-50">
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-1 bg-purple-500 rounded-full"></div>
                        <CardTitle className="text-lg font-bold text-[#0F172A]">Calculation Rules</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-slate-500">GST %</Label>
                            <Input
                                type="number"
                                placeholder="0"
                                value={localConfig.calculationRules?.gstPercent ?? ""}
                                onChange={(e) => setLocalConfig({
                                    ...localConfig,
                                    calculationRules: {
                                        ...localConfig.calculationRules,
                                        gstPercent: e.target.value ? parseFloat(e.target.value) : 0
                                    }
                                })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-slate-500">Discount %</Label>
                            <Input
                                type="number"
                                placeholder="0"
                                value={localConfig.calculationRules?.discountPercent ?? ""}
                                onChange={(e) => setLocalConfig({
                                    ...localConfig,
                                    calculationRules: {
                                        ...localConfig.calculationRules,
                                        discountPercent: e.target.value ? parseFloat(e.target.value) : 0
                                    }
                                })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-slate-500">Design Fee %</Label>
                            <Input
                                type="number"
                                placeholder="0"
                                value={localConfig.calculationRules?.designFeePercent ?? ""}
                                onChange={(e) => setLocalConfig({
                                    ...localConfig,
                                    calculationRules: {
                                        ...localConfig.calculationRules,
                                        designFeePercent: e.target.value ? parseFloat(e.target.value) : 0
                                    }
                                })}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-slate-500">Round to Nearest (optional)</Label>
                        <Input
                            type="number"
                            placeholder="e.g. 100"
                            className="max-w-xs"
                            value={localConfig.calculationRules?.roundToNearest ?? ""}
                            onChange={(e) => setLocalConfig({
                                ...localConfig,
                                calculationRules: {
                                    ...localConfig.calculationRules,
                                    roundToNearest: e.target.value ? parseInt(e.target.value) : undefined
                                }
                            })}
                        />
                    </div>

                    {/* Additional Charges */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold uppercase text-slate-500">Additional Charges</Label>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-purple-600 hover:text-purple-700"
                                onClick={() => {
                                    const charges = localConfig.calculationRules?.additionalCharges || [];
                                    setLocalConfig({
                                        ...localConfig,
                                        calculationRules: {
                                            ...localConfig.calculationRules,
                                            additionalCharges: [...charges, { id: `charge_${Date.now()}`, label: '', type: 'percentage', value: 0, enabled: true }]
                                        }
                                    });
                                }}
                            >
                                <Plus className="h-4 w-4 mr-1" /> Add Charge
                            </Button>
                        </div>
                        {(localConfig.calculationRules?.additionalCharges || []).map((charge, idx) => (
                            <div key={charge.id} className="grid grid-cols-5 gap-3 items-end border rounded-lg p-3">
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-slate-400">Label</Label>
                                    <Input
                                        className="h-8 text-sm"
                                        placeholder="e.g. Service Tax"
                                        value={charge.label}
                                        onChange={(e) => {
                                            const charges = [...(localConfig.calculationRules?.additionalCharges || [])];
                                            charges[idx] = { ...charges[idx], label: e.target.value };
                                            setLocalConfig({
                                                ...localConfig,
                                                calculationRules: { ...localConfig.calculationRules, additionalCharges: charges }
                                            });
                                        }}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-slate-400">Type</Label>
                                    <Select
                                        value={charge.type}
                                        onValueChange={(value: 'percentage' | 'fixed') => {
                                            const charges = [...(localConfig.calculationRules?.additionalCharges || [])];
                                            charges[idx] = { ...charges[idx], type: value };
                                            setLocalConfig({
                                                ...localConfig,
                                                calculationRules: { ...localConfig.calculationRules, additionalCharges: charges }
                                            });
                                        }}
                                    >
                                        <SelectTrigger className="h-8 text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="percentage">Percentage</SelectItem>
                                            <SelectItem value="fixed">Fixed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-slate-400">Value</Label>
                                    <Input
                                        type="number"
                                        className="h-8 text-sm"
                                        value={charge.value}
                                        onChange={(e) => {
                                            const charges = [...(localConfig.calculationRules?.additionalCharges || [])];
                                            charges[idx] = { ...charges[idx], value: parseFloat(e.target.value) || 0 };
                                            setLocalConfig({
                                                ...localConfig,
                                                calculationRules: { ...localConfig.calculationRules, additionalCharges: charges }
                                            });
                                        }}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-slate-400">Enabled</Label>
                                    <button
                                        onClick={() => {
                                            const charges = [...(localConfig.calculationRules?.additionalCharges || [])];
                                            charges[idx] = { ...charges[idx], enabled: !charges[idx].enabled };
                                            setLocalConfig({
                                                ...localConfig,
                                                calculationRules: { ...localConfig.calculationRules, additionalCharges: charges }
                                            });
                                        }}
                                        className={cn(
                                            "relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                                            charge.enabled ? "bg-emerald-500" : "bg-slate-200"
                                        )}
                                    >
                                        <span className={cn(
                                            "pointer-events-none block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform",
                                            charge.enabled ? "translate-x-5" : "translate-x-0"
                                        )} />
                                    </button>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => {
                                        const charges = (localConfig.calculationRules?.additionalCharges || []).filter(c => c.id !== charge.id);
                                        setLocalConfig({
                                            ...localConfig,
                                            calculationRules: { ...localConfig.calculationRules, additionalCharges: charges }
                                        });
                                    }}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Add Category Dialog */}
            <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Category</DialogTitle>
                        <DialogDescription>Create a new category to organize your pricing items.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Category Type</Label>
                            <Select value={newCategoryType} onValueChange={(value: 'residential' | 'commercial') => setNewCategoryType(value)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="residential">Residential</SelectItem>
                                    <SelectItem value="commercial">Commercial</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Category Name</Label>
                            <Input
                                placeholder="e.g., Living Area, Office Space, Reception"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowAddCategory(false)}>Cancel</Button>
                        <Button onClick={addCategory}>Add Category</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Item Dialog */}
            <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Add New Item</DialogTitle>
                        <DialogDescription>Add a new pricing item to the selected category.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Item Name</Label>
                            <Input
                                placeholder="e.g., TV Unit, Wardrobe, Vanity"
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Pricing Type</Label>
                            <Select value={newItemType} onValueChange={(value: 'fixed' | 'perUnit' | 'perSqft') => setNewItemType(value)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fixed">Fixed Price (one-time)</SelectItem>
                                    <SelectItem value="perUnit">Per Unit (quantity-based)</SelectItem>
                                    <SelectItem value="perSqft">Per Sqft (area-based)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Basic Price (₹)</Label>
                                <Input
                                    type="number"
                                    placeholder="28000"
                                    value={newItemBasicPrice}
                                    onChange={(e) => setNewItemBasicPrice(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Standard Price (₹)</Label>
                                <Input
                                    type="number"
                                    placeholder="35000"
                                    value={newItemStandardPrice}
                                    onChange={(e) => setNewItemStandardPrice(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Luxe Price (₹)</Label>
                                <Input
                                    type="number"
                                    placeholder="42000"
                                    value={newItemLuxePrice}
                                    onChange={(e) => setNewItemLuxePrice(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Default Quantity (optional)</Label>
                            <Input
                                type="number"
                                placeholder="0"
                                value={newItemDefaultQuantity}
                                onChange={(e) => setNewItemDefaultQuantity(e.target.value)}
                            />
                            <p className="text-xs text-slate-400 mt-1">Pre-filled quantity in estimate wizard</p>
                        </div>
                        <div>
                            <Label>Plan Visibility</Label>
                            <div className="flex gap-4 mt-2">
                                {(['Basic', 'Standard', 'Luxe'] as const).map(plan => (
                                    <label key={plan} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-300"
                                            checked={newItemPlanVisibility.length === 0 || newItemPlanVisibility.includes(plan)}
                                            onChange={(e) => {
                                                if (newItemPlanVisibility.length === 0) {
                                                    // First uncheck: set all except this one
                                                    setNewItemPlanVisibility((['Basic', 'Standard', 'Luxe'] as const).filter(p => p !== plan));
                                                } else if (e.target.checked) {
                                                    const updated = [...newItemPlanVisibility, plan];
                                                    setNewItemPlanVisibility(updated.length === 3 ? [] : updated);
                                                } else {
                                                    setNewItemPlanVisibility(newItemPlanVisibility.filter(p => p !== plan));
                                                }
                                            }}
                                        />
                                        <span className="text-sm">{plan}</span>
                                    </label>
                                ))}
                            </div>
                            <p className="text-xs text-slate-400 mt-1">All checked = visible to all plans</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowAddItem(false)}>Cancel</Button>
                        <Button onClick={addItem}>Add Item</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Kitchen Layout Dialog */}
            <Dialog open={showAddKitchenLayout} onOpenChange={setShowAddKitchenLayout}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Kitchen Layout</DialogTitle>
                        <DialogDescription>Add a new kitchen layout option for the dropdown.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Layout Name</Label>
                            <Input
                                placeholder="e.g., L-Shape, U-Shape, Island"
                                value={newKitchenLayoutName}
                                onChange={(e) => setNewKitchenLayoutName(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowAddKitchenLayout(false)}>Cancel</Button>
                        <Button onClick={addKitchenLayout}>Add Layout</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Kitchen Material Dialog */}
            <Dialog open={showAddKitchenMaterial} onOpenChange={setShowAddKitchenMaterial}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Kitchen Material</DialogTitle>
                        <DialogDescription>Add a new kitchen material option for the dropdown.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Material Name</Label>
                            <Input
                                placeholder="e.g., Marine Ply, HDHMR, MDF"
                                value={newKitchenMaterialName}
                                onChange={(e) => setNewKitchenMaterialName(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowAddKitchenMaterial(false)}>Cancel</Button>
                        <Button onClick={addKitchenMaterial}>Add Material</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
