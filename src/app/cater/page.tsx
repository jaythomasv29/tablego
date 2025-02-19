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
    specialRequests?: string;
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
        specialRequests: '',
        selectedDishes: [],
    });

    const [menuItems, setMenuItems] = useState<Array<{
        id: string;
        name: string;
        description: string;
        imageUrl?: string;
        category: string;
    }>>([]);

    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchMenuItems = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'menu'));
                const items = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().name || '',
                    description: doc.data().description || '',
                    imageUrl: doc.data().imageUrl,
                    category: doc.data().category || ''
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
        if (step === 1 && !validateStep1()) {
            alert('Please fill in all required fields');
            return;
        }
        if (step === 2 && !validateStep2()) {
            alert('Please fill in all required fields');
            return;
        }
        setStep(prev => prev + 1);
    };

    const handleBack = () => {
        setStep(prev => prev - 1);
    };

    const validateStep1 = () => {
        return formData.name.trim() !== '' &&
            formData.email.trim() !== '' &&
            formData.phone.trim() !== '';
    };

    const validateStep2 = () => {
        return formData.address.trim() !== '' &&
            formData.date.trim() !== '' &&
            formData.time.trim() !== '' &&
            formData.partySize.trim() !== '';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isSubmitting) return;

        try {
            const selectedDishesWithDetails = formData.selectedDishes.map(id => {
                const dish = menuItems.find(item => item.id === id);
                return {
                    id: dish?.id,
                    name: dish?.name,
                    description: dish?.description,
                    imageUrl: dish?.imageUrl
                };
            });

            const response = await fetch('/api/send-proposal', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    formData: {
                        ...formData,
                        selectedDishes: selectedDishesWithDetails
                    }
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // If we reach here, the submission was successful
            setShowSuccessModal(true);
            // Reset form
            setFormData({
                name: '',
                email: '',
                phone: '',
                address: '',
                budget: '',
                date: '',
                time: '',
                partySize: '',
                specialRequests: '',
                selectedDishes: [],
            });
            setStep(1);

        } catch (error) {
            console.error('Error submitting form:', error);
            // Only show error alert if email wasn't sent
            if (error instanceof Error && !error.message.includes('200')) {
                alert('Failed to submit inquiry. Please try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputClassName = "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500";

    const handleDishSelection = (itemId: string) => {
        setFormData(prev => {
            if (prev.selectedDishes.includes(itemId)) {
                return {
                    ...prev,
                    selectedDishes: prev.selectedDishes.filter(id => id !== itemId)
                };
            }
            return {
                ...prev,
                selectedDishes: [...prev.selectedDishes, itemId]
            };
        });
    };

    const formatDisplayDate = (dateString: string) => {
        if (!dateString) return '';

        // Split the date string to get year, month, day
        const [year, month, day] = dateString.split('-').map(Number);

        // Create date object with explicit UTC time at noon to avoid timezone shifts
        const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC'  // Keep it in UTC to prevent shifts
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
                                            We appreciate your interest in our catering services and are happy to fire up our woks for you! (For immediate inquiries, please call us at 650-323-7700 or email us at thaiphoonpaloalto@gmail.com)
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
                                            placeholder="Your full name *"
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
                                            placeholder="Event location *"
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
                                            placeholder="Approximate budget (optional)"
                                            className={inputClassName}
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
                                            min={new Date().toISOString().split('T')[0]}
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
                                            placeholder="Number of guests *"
                                            className={inputClassName}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Special Requests</label>
                                        <textarea
                                            name="specialRequests"
                                            value={formData.specialRequests}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                specialRequests: e.target.value
                                            }))}
                                            className={`${inputClassName} min-h-[100px]`}
                                            placeholder="Any dietary restrictions, allergies, or special accommodations?"
                                        />
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-6">
                                    <div className="mb-8 text-gray-600 border-b pb-6">
                                        <p className="text-base leading-relaxed">
                                            Select the dishes you'd like to include in your catering package:
                                        </p>
                                    </div>

                                    {/* Categories in order */}
                                    {['Appetizers', 'Soup', 'Salad', 'Signature Dishes', 'Wok', 'Curry', 'Sides'].map(category => {
                                        const categoryItems = menuItems.filter(item => item.category === category);

                                        return categoryItems.length > 0 ? (
                                            <div key={category} className="mb-8">
                                                <h3 className="text-lg font-medium text-gray-800 mb-4">{category}</h3>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                                    {categoryItems.map((item) => (
                                                        <button
                                                            key={item.id}
                                                            type="button"
                                                            onClick={() => handleDishSelection(item.id)}
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
                                                                cursor-pointer
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
                                            </div>
                                        ) : null;
                                    })}

                                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                        <p className="text-sm text-gray-600">
                                            Selected dishes ({formData.selectedDishes.length}):
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
                                    <h3 className="text-lg font-medium text-gray-700 mb-4">Confirm Your Details</h3>

                                    {/* Personal Details */}
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <h4 className="text-md font-medium text-gray-700 mb-3">Personal Information</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-sm text-gray-500">Name</p>
                                                <p className="text-sm font-medium">{formData.name}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Email</p>
                                                <p className="text-sm font-medium">{formData.email}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Phone</p>
                                                <p className="text-sm font-medium">{formData.phone}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Event Details */}
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <h4 className="text-md font-medium text-gray-700 mb-3">Event Information</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-sm text-gray-500">Date</p>
                                                <p className="text-sm font-medium">{formatDisplayDate(formData.date)}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Time</p>
                                                <p className="text-sm font-medium">{formData.time}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Party Size</p>
                                                <p className="text-sm font-medium">{formData.partySize} guests</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Budget</p>
                                                <p className="text-sm font-medium">${formData.budget}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-sm text-gray-500">Event Address</p>
                                                <p className="text-sm font-medium">{formData.address}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Selected Dishes */}
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <h4 className="text-md font-medium text-gray-700 mb-3">
                                            Selected Dishes ({formData.selectedDishes.length})
                                        </h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                            {formData.selectedDishes.map((id) => {
                                                const item = menuItems.find(item => item.id === id);
                                                return item ? (
                                                    <div key={id} className="bg-white rounded-lg p-3 shadow-sm">
                                                        <div className="h-24 w-full mb-2">
                                                            <img
                                                                src={item.imageUrl || "https://placehold.co/400x300"}
                                                                alt={item.name}
                                                                className="h-full w-full object-cover rounded"
                                                            />
                                                        </div>
                                                        <h5 className="text-sm font-medium text-gray-900">{item.name}</h5>
                                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                                            {item.description}
                                                        </p>
                                                    </div>
                                                ) : null;
                                            })}
                                        </div>
                                    </div>

                                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                                        <p className="text-sm text-blue-700">
                                            Please review all details before submitting. Our team will contact you within 24-48 hours to discuss your catering request.
                                        </p>
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
                                        onClick={() => setIsSubmitting(true)}
                                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors ml-auto"
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

            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                                <svg
                                    className="h-6 w-6 text-green-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </div>
                            <h3 className="mt-4 text-lg font-medium text-gray-900">
                                Catering Inquiry Submitted!
                            </h3>
                            <p className="mt-2 text-sm text-gray-500">
                                Thank you for your interest in our catering services. Our team will review your request and contact you within 24-48 hours to discuss the details.
                            </p>
                            <div className="mt-6">
                                <button
                                    onClick={() => setShowSuccessModal(false)}
                                    className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500"
                                >
                                    Got it, thanks!
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default CateringPage;
