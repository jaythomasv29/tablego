import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MenuItem {
    id: number;
    name: string;
    image: string;
    description: string;
}

const menuItems: MenuItem[] = [
    {
        id: 1,
        name: "Pad Thai",
        image: "/images/Thaiphoon_Food_Pics/Basil_Fried_Rice.jpg",
        description: "Classic stir-fried rice noodles with eggs, tofu, and shrimp"
    },
    {
        id: 2,
        name: "Green Curry",
        image: "/images/Thaiphoon_Food_Pics/Basil_Fried_Rice.jpg",
        description: "Creamy coconut curry with bamboo shoots and Thai basil"
    },
    {
        id: 3,
        name: "Tom Yum Soup",
        image: "/images/Thaiphoon_Food_Pics/Basil_Fried_Rice.jpg",
        description: "Hot and sour soup with lemongrass and shrimp"
    },
    // Add more menu items as needed
];

export default function MenuCarousel() {
    const [currentIndex, setCurrentIndex] = useState(0);

    const nextSlide = () => {
        setCurrentIndex((prev) => (prev + 1) % menuItems.length);
    };

    const prevSlide = () => {
        setCurrentIndex((prev) => (prev - 1 + menuItems.length) % menuItems.length);
    };

    return (
        <div className="mt-16 relative">
            <h4 className="text-2xl font-medium text-white mb-6 text-center">
                Featured Dishes
            </h4>
            <div className="relative w-[400px] h-[200px] mx-auto">
                <div className="overflow-hidden relative rounded-xl h-full">
                    <div
                        className="flex transition-transform duration-500 ease-out h-full"
                        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                    >
                        {menuItems.map((item) => (
                            <div key={item.id} className="w-[400px] flex-shrink-0">
                                <div className="relative h-[200px]">
                                    <img
                                        src={item.image}
                                        alt={item.name}
                                        className="w-full h-full object-contain rounded-xl"
                                    />
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                                        <h5 className="text-lg font-medium text-white mb-1">{item.name}</h5>
                                        <p className="text-gray-200 text-xs">{item.description}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Navigation Buttons */}
                <button
                    onClick={prevSlide}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/50 rounded-full p-1.5 backdrop-blur-sm transition-colors"
                >
                    <ChevronLeft className="w-4 h-4 text-white" />
                </button>
                <button
                    onClick={nextSlide}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/50 rounded-full p-1.5 backdrop-blur-sm transition-colors"
                >
                    <ChevronRight className="w-4 h-4 text-white" />
                </button>

                {/* Dots */}
                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-2">
                    {menuItems.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={`w-2 h-2 rounded-full transition-colors ${index === currentIndex ? 'bg-white' : 'bg-white/50'
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
} 