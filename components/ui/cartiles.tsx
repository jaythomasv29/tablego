import React from 'react';

const tiles = [
    { image: '/images/restaurant.jpg', name: 'Thaiphoon Restaurant', description: 'Authentic Thai Cuisine', promotion: 'Happy Hour Everyday from 4pm to 6pm' },
    { image: '/images/award-dishes.jpg', name: 'Award-Winning Dishes', description: 'Must try our Pad se ew noodles and drunken noodles' },
    { image: '/images/catering.jpg', name: 'Cater with Us', description: 'Cater your next event with us' },
];

export function CarTiles() {
    return (
        <div className="grid grid-cols-3 gap-4 w-full">
            {tiles.map((tile, index) => (
                <div
                    key={index}
                    className="bg-white rounded-lg shadow-md overflow-hidden transition-transform hover:scale-105"
                >
                    <img src={tile.image} alt={tile.name} className="w-full h-40 object-cover" />
                    <div className="p-4">
                        <h3 className="font-bold text-lg mb-1">{tile.name}</h3>
                        <p className="text-gray-600 text-sm">{tile.description}</p>
                        {tile.promotion && <p className="text-red-500 font-semibold text-sm mt-2">{tile.promotion}</p>}
                    </div>
                </div>
            ))}
        </div>
    );
}