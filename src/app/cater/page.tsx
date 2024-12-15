'use client';
import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';

interface FormData {
    // Step 1
    name: string;
    email: string;
    phone: string;
    // Step 2
    address: string;
    budget: string;
    date: string;
    time: string;
    partySize: string;
    // Step 3
    selectedDishes: string[];
}

const CateringPage = () => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<FormData>({
        name: '',
        email: '',
        phone: '',
        address: '',
        budget: '',
        date: '',
        time: '',
        partySize: '',
        selectedDishes: [],
    });

    const [menuItems, setMenuItems] = useState<Array<{
        id: string;
        name: string;
        description: string;
        imageUrl?: string;
    }>>([]);

    useEffect(() => {
        const fetchMenuItems = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'menu'));
                const items = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setMenuItems(items);
            } catch (error) {
                console.error('Error fetching menu items:', error);
            }
        };

        fetchMenuItems();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleNext = () => {
        setStep(prev => prev + 1);
    };

    const handleBack = () => {
        setStep(prev => prev - 1);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Handle form submission here
        console.log(formData);
    };

    const inputClassName = "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500";

    const calculateMaxItems = (partySize: number): number => {
        if (partySize <= 25) return 4;
        if (partySize > 25 && partySize <= 30) return Math.round(partySize / 7);
        return Math.round(partySize / 6);
    };

    const handleDishSelection = (itemId: string) => {
        setFormData(prev => {
            if (prev.selectedDishes.includes(itemId)) {
                return {
                    ...prev,
                    selectedDishes: prev.selectedDishes.filter(id => id !== itemId)
                };
            }

            const maxItems = calculateMaxItems(parseInt(prev.partySize));
            if (prev.selectedDishes.length >= maxItems) return prev;

            return {
                ...prev,
                selectedDishes: [...prev.selectedDishes, itemId]
            };
        });
    };

    return (
        <>
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
                <Navbar />
                <Link
                    href="/"
                    className="fixed top-1/2 left-4 transform -translate-y-1/2 flex flex-col items-center gap-2 z-20"
                    passHref
                >
                    <div className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors cursor-pointer">
                        <ArrowLeft className="h-6 w-6 text-gray-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-600 bg-white/80 backdrop-blur-sm px-2 py-1 rounded shadow-sm">
                        Home
                    </span>
                </Link>

                <main className="max-w-3xl mx-auto px-4 py-8">
                    <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-800">Catering Inquiry</h2>
                            <div className="mt-4 flex justify-between">
                                {[1, 2, 3, 4].map((i) => (
                                    <div
                                        key={i}
                                        className={`w-1/4 h-2 rounded-full mx-1 ${step >= i ? 'bg-indigo-600' : 'bg-gray-200'
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>

                        <form onSubmit={handleSubmit}>
                            {step === 1 && (
                                <div className="space-y-4">
                                    <div className="mb-8 text-gray-600 border-b pb-6">
                                        <p className="text-base leading-relaxed">
                                            We appreciate your interest in our catering services and are happy to fire up our woks for you!
                                        </p>
                                        <p className="text-base leading-relaxed mt-4">
                                            Let's get started by entering some customer details:
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Name</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            className={inputClassName}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Email</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            className={inputClassName}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Phone</label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleInputChange}
                                            className={inputClassName}
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-4">
                                    <div className="mb-8 text-gray-600 border-b pb-6">
                                        <p className="text-base leading-relaxed">
                                            Lets get some general information of when this event is going down. This is a general baseline and we are happy to work with you! All information will be confirmed with our head staff.
                                        </p>
                                        <p className="text-base leading-relaxed mt-4">
                                            Let's get some event information:
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Event Address</label>
                                        <input
                                            type="text"
                                            name="address"
                                            value={formData.address}
                                            onChange={handleInputChange}
                                            placeholder="e.g 543 Emerson St. Palo Alto, CA 94301"
                                            className={inputClassName}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Approximate Budget</label>
                                        <input
                                            type="number"
                                            name="budget"
                                            value={formData.budget}
                                            onChange={handleInputChange}
                                            className={inputClassName}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Date</label>
                                        <input
                                            type="date"
                                            name="date"
                                            value={formData.date}
                                            onChange={handleInputChange}
                                            className={inputClassName}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Time</label>
                                        <input
                                            type="time"
                                            name="time"
                                            value={formData.time}
                                            onChange={handleInputChange}
                                            className={inputClassName}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Party Size</label>
                                        <input
                                            type="number"
                                            name="partySize"
                                            value={formData.partySize}
                                            onChange={handleInputChange}
                                            className={inputClassName}
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-6">
                                    <div className="mb-8 text-gray-600 border-b pb-6">
                                        <p className="text-base leading-relaxed">
                                            Based on your party size of {formData.partySize}, you can select up to {calculateMaxItems(parseInt(formData.partySize))} dishes.
                                        </p>
                                        <p className="text-base leading-relaxed mt-4">
                                            Click on the dishes you'd like to include in your catering package:
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                        {menuItems.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => handleDishSelection(item.id)}
                                                disabled={
                                                    !formData.selectedDishes.includes(item.id) &&
                                                    formData.selectedDishes.length >= calculateMaxItems(parseInt(formData.partySize))
                                                }
                                                className={`
                                                    relative p-4 rounded-lg border transition-all
                                                    ${formData.selectedDishes.includes(item.id)
                                                        ? 'border-green-500 bg-green-50'
                                                        : 'border-gray-200 hover:border-gray-300'
                                                    }
                                                    ${formData.selectedDishes.includes(item.id)
                                                        ? 'ring-2 ring-green-500 ring-opacity-50'
                                                        : ''
                                                    }
                                                    ${(!formData.selectedDishes.includes(item.id) &&
                                                        formData.selectedDishes.length >= calculateMaxItems(parseInt(formData.partySize)))
                                                        ? 'opacity-50 cursor-not-allowed'
                                                        : 'cursor-pointer'
                                                    }
                                                `}
                                            >
                                                <div className="h-24 w-full mb-2">
                                                    <img
                                                        src={item.imageUrl || "https://placehold.co/400x300"}
                                                        alt={item.name}
                                                        className="h-full w-full object-cover rounded"
                                                    />
                                                </div>
                                                <h3 className="text-sm font-medium text-gray-900">{item.name}</h3>
                                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                        <p className="text-sm text-gray-600">
                                            Selected dishes ({formData.selectedDishes.length}/{calculateMaxItems(parseInt(formData.partySize))}):
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {formData.selectedDishes.map((id) => {
                                                const item = menuItems.find(item => item.id === id);
                                                return (
                                                    <span
                                                        key={id}
                                                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                                                    >
                                                        {item?.name}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 4 && (
                                <div className="space-y-6">
                                    <div className="mb-8 text-gray-600 border-b pb-6">
                                        <p className="text-base leading-relaxed">
                                            Please review your catering inquiry details below. Once submitted, our team will reach out within 24-48 hours to discuss your event in detail.
                                        </p>
                                    </div>

                                    <div className="space-y-6">
                                        {/* Customer Details Section */}
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <h4 className="text-sm font-medium text-gray-900 mb-4">Customer Details</h4>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <span className="text-gray-500">Name:</span>
                                                    <p className="font-medium text-gray-900">{formData.name}</p>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Email:</span>
                                                    <p className="font-medium text-gray-900">{formData.email}</p>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Phone:</span>
                                                    <p className="font-medium text-gray-900">{formData.phone}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Event Details Section */}
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <h4 className="text-sm font-medium text-gray-900 mb-4">Event Details</h4>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <span className="text-gray-500">Event Address:</span>
                                                    <p className="font-medium text-gray-900">{formData.address}</p>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Date:</span>
                                                    <p className="font-medium text-gray-900">{formData.date}</p>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Time:</span>
                                                    <p className="font-medium text-gray-900">{formData.time}</p>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Party Size:</span>
                                                    <p className="font-medium text-gray-900">{formData.partySize} people</p>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Approximate Budget:</span>
                                                    <p className="font-medium text-gray-900">${formData.budget}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Selected Dishes Section */}
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <h4 className="text-sm font-medium text-gray-900 mb-4">
                                                Selected Dishes ({formData.selectedDishes.length})
                                            </h4>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                                {formData.selectedDishes.map((id) => {
                                                    const item = menuItems.find(item => item.id === id);
                                                    return (
                                                        <div key={id} className="flex items-start space-x-3">
                                                            <div className="h-12 w-12 flex-shrink-0">
                                                                <img
                                                                    src={item?.imageUrl || "https://placehold.co/400x300"}
                                                                    alt={item?.name}
                                                                    className="h-full w-full object-cover rounded"
                                                                />
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="text-sm font-medium text-gray-900">{item?.name}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                            <p className="text-sm text-yellow-800">
                                                By submitting this inquiry, you acknowledge that this is an initial request and final details will be confirmed by our catering team. Prices and availability may vary.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="mt-6 flex justify-between">
                                {step > 1 && (
                                    <button
                                        type="button"
                                        onClick={handleBack}
                                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
                                    >
                                        Back
                                    </button>
                                )}
                                {step < 4 ? (
                                    <button
                                        type="button"
                                        onClick={handleNext}
                                        className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition-colors ml-auto"
                                    >
                                        Next
                                    </button>
                                ) : (
                                    <button
                                        type="submit"
                                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors ml-auto"
                                    >
                                        Submit Inquiry
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </main>
            </div>
            <Footer />
        </>
    );
};

export default CateringPage;
