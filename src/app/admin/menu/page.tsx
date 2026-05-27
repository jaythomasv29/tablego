"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase";
import AdminLayout from "@/components/AdminLayout";
import Link from "next/link";
import { seedMenu } from "@/utils/seedMenu";

interface MenuItem {
  id?: string;
  name: string;
  price?: number;
  description: string;
  category: string;
  imageUrl: string;
}

const groupByCategory = (items: MenuItem[]) =>
  items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as { [key: string]: MenuItem[] });

const CATEGORY_ORDER = [
  "Appetizers", "Salad", "Soup", "Signature Dishes",
  "Wok", "Curry", "Noodles", "Fried Rice", "Grill", "Sides", "Desserts",
];

const sortByCategory = (items: MenuItem[]) => {
  const grouped = groupByCategory(items);
  return CATEGORY_ORDER.map((category) => ({ category, items: grouped[category] || [] })).filter((g) => g.items.length > 0);
};

const inputClass = "mt-1 block w-full rounded-md border border-border bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring px-3 py-2 text-sm";

const EditModal = ({ item, isOpen, onClose, onSave }: { item: MenuItem; isOpen: boolean; onClose: () => void; onSave: (item: MenuItem) => void; }) => {
  const [editedItem, setEditedItem] = useState(item);
  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      ...editedItem,
      id: item.id,
      price: parseFloat(editedItem?.price?.toString() || "0"),
      name: editedItem.name.trim(),
      description: editedItem.description.trim(),
      category: editedItem.category.trim(),
      imageUrl: editedItem.imageUrl?.trim() || "",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl shadow-2xl">
        <h2 className="text-xl font-bold text-foreground mb-4">Edit Menu Item</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: "Name", key: "name", type: "text" },
            { label: "Category", key: "category", type: "text" },
            { label: "Price", key: "price", type: "number" },
            { label: "Image URL (optional)", key: "imageUrl", type: "url" },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-foreground">{label}</label>
              <input
                type={type}
                step={type === "number" ? "0.01" : undefined}
                value={(editedItem as any)[key] ?? ""}
                onChange={(e) => setEditedItem({ ...editedItem, [key]: type === "number" ? parseFloat(e.target.value) : e.target.value })}
                className={inputClass}
              />
            </div>
          ))}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-foreground">Description</label>
            <textarea
              value={editedItem.description}
              onChange={(e) => setEditedItem({ ...editedItem, description: e.target.value })}
              className={inputClass}
              rows={3}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded text-sm bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 rounded text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Save Changes</button>
        </div>
      </div>
    </div>
  );
};

export default function MenuManagement() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState({ name: "", description: "", price: "", category: "", imageUrl: "" });
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [viewMode, setViewMode] = useState<"store" | "multi">("store");

  useEffect(() => { fetchMenuItems(); }, []);

  const fetchMenuItems = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "menu"));
      setMenuItems(querySnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<MenuItem, "id">) })));
    } catch (error) {
      console.error("Error fetching menu items:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "menu"), {
        name: newItem.name, description: newItem.description,
        price: parseFloat(newItem.price), category: newItem.category,
      });
      setNewItem({ name: "", description: "", price: "", category: "", imageUrl: "" });
      fetchMenuItems();
    } catch (error) {
      console.error("Error adding menu item:", error);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (typeof window !== "undefined" && window.confirm("Are you sure you want to delete this item?")) {
      try {
        await deleteDoc(doc(db, "menu", id));
        fetchMenuItems();
      } catch (error) {
        console.error("Error deleting menu item:", error);
      }
    }
  };

  const handleEditItem = async (editedItem: MenuItem) => {
    try {
      if (editedItem.id) {
        await updateDoc(doc(db, "menu", editedItem.id), {
          name: editedItem.name, description: editedItem.description,
          price: editedItem.price, category: editedItem.category,
          imageUrl: editedItem.imageUrl || "",
        });
      }
      setMenuItems((prev) => prev.map((item) => item.id === editedItem.id ? editedItem : item));
      setModalOpen(false);
    } catch (error) {
      console.error("Error updating menu item:", error);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <Link href="/admin/home" className="inline-flex items-center mb-4 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-foreground">Menu Management</h1>
          <div className="flex gap-2">
            {(["store", "multi"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  viewMode === mode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {mode === "store" ? "Store View" : "Multi Edit View"}
              </button>
            ))}
          </div>
        </div>

        {viewMode === "store" ? (
          <>
            {/* Quick Navigation */}
            <div className="mb-8 bg-card border border-border p-4 rounded-lg shadow-sm sticky top-0 z-10">
              <h3 className="text-sm font-semibold text-foreground mb-2">Quick Navigation</h3>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_ORDER.map((category) => (
                  <a key={category} href={`#${category.toLowerCase().replace(/\s+/g, "-")}`}
                    className="px-3 py-1 bg-muted hover:bg-muted/80 rounded-full text-sm text-muted-foreground transition-colors">
                    {category}
                  </a>
                ))}
              </div>
            </div>

            {/* Add / Edit Form */}
            <form
              onSubmit={(e) => { e.preventDefault(); isEditing ? handleEditItem({ ...newItem, price: Number(newItem.price) } as MenuItem) : handleAddItem(e); }}
              className="mb-8 bg-card border border-border p-6 rounded-lg shadow-sm"
            >
              <h2 className="text-lg font-semibold text-foreground mb-4">{isEditing ? "Edit Menu Item" : "Add New Menu Item"}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: "Name", key: "name", type: "text", required: true },
                  { label: "Category", key: "category", type: "text", required: true },
                  { label: "Price", key: "price", type: "number", required: true },
                  { label: "Image URL (optional)", key: "imageUrl", type: "url", required: false },
                ].map(({ label, key, type, required }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-foreground">{label}</label>
                    <input
                      type={type}
                      step={type === "number" ? "0.01" : undefined}
                      value={(newItem as any)[key]}
                      onChange={(e) => setNewItem({ ...newItem, [key]: e.target.value })}
                      className={inputClass}
                      required={required}
                      placeholder={key === "imageUrl" ? "https://example.com/image.jpg" : undefined}
                    />
                  </div>
                ))}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground">Description</label>
                  <textarea
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    className={inputClass}
                    required
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button type="submit" className="px-4 py-2 rounded text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium">
                  {isEditing ? "Update Item" : "Add Item"}
                </button>
                {isEditing && (
                  <button type="button" onClick={() => { setIsEditing(false); setEditingId(""); setNewItem({ name: "", description: "", price: "", category: "", imageUrl: "" }); }}
                    className="px-4 py-2 rounded text-sm bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
              </div>
            ) : (
              <div className="space-y-12">
                {sortByCategory(menuItems).map(({ category, items }) => (
                  <div key={category} id={category.toLowerCase().replace(/\s+/g, "-")} className="scroll-mt-24">
                    <div className="flex items-center mb-6">
                      <h2 className="text-2xl font-bold text-foreground">{category}</h2>
                      <div className="ml-4 flex-grow border-b border-border" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {items.map((item) => (
                        <div key={item.id} className="bg-card border border-border rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                          <div className="h-48 bg-muted">
                            <img src={item.imageUrl || "https://placehold.co/400x300/e2e8f0/666666?text=Plate+of+Food"} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="text-base font-semibold text-foreground">{item.name}</h3>
                              <span className="text-green-600 font-bold text-sm">${item.price?.toFixed(2) || "0.00"}</span>
                            </div>
                            <p className="text-muted-foreground text-sm mb-4">{item.description}</p>
                            <div className="flex justify-end gap-3">
                              <button onClick={() => { setSelectedItem(item); setModalOpen(true); }} className="text-sm text-primary hover:text-primary/80 transition-colors">Edit</button>
                              <button onClick={() => handleDeleteItem(item?.id || "")} className="text-sm text-destructive hover:text-destructive/80 transition-colors">Delete</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {modalOpen && selectedItem && (
              <EditModal item={selectedItem} isOpen={modalOpen} onClose={() => setModalOpen(false)} onSave={handleEditItem} />
            )}
          </>
        ) : (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Multi Edit View</h2>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full bg-card">
                <thead className="bg-muted">
                  <tr>
                    {["Image", "Name", "Category", "Price", "Description", "Image URL", "Actions"].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortByCategory(menuItems).flatMap(({ items }) =>
                    items.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <img src={item.imageUrl || "https://placehold.co/400x300/e2e8f0/666666?text=Plate+of+Food"} alt={item.name} className="w-20 h-20 object-cover rounded border border-border" />
                        </td>
                        {[
                          { key: "name", type: "text" },
                          { key: "category", type: "text" },
                          { key: "price", type: "number" },
                        ].map(({ key, type }) => (
                          <td key={key} className="px-6 py-4 whitespace-nowrap">
                            <input
                              type={type}
                              step={type === "number" ? "0.01" : undefined}
                              defaultValue={(item as any)[key]}
                              className="w-full border border-border rounded-md shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring px-2 py-1 text-sm"
                              onBlur={(e) => handleEditItem({ ...item, [key]: type === "number" ? parseFloat(e.target.value) : e.target.value })}
                            />
                          </td>
                        ))}
                        <td className="px-6 py-4">
                          <textarea
                            defaultValue={item.description}
                            className="w-full border border-border rounded-md shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring px-2 py-1 text-sm"
                            onBlur={(e) => handleEditItem({ ...item, description: e.target.value })}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="url"
                            defaultValue={item.imageUrl}
                            className="w-full border border-border rounded-md shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring px-2 py-1 text-sm"
                            onBlur={(e) => handleEditItem({ ...item, imageUrl: e.target.value })}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button onClick={() => handleDeleteItem(item.id || "")} className="text-sm text-destructive hover:text-destructive/80 transition-colors">Delete</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
