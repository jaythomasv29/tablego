import React from 'react';
import { Button } from '@mui/material';

const tiles = [
    { image: '/images/restaurant.jpg', name: 'Thaiphoon Restaurant', description: 'Authentic Thai Cuisine', promotion: 'Happy Hour Everyday from 4pm to 6pm', btnTitle: "Happy Hour Menu" },
    { image: '/images/award-dishes.jpeg', name: 'Award-Winning Dishes', description: 'Must try our Pad se ew noodles and drunken noodles', btnTitle: "Explore Menu" },
    { image: '/images/catering.jpg', name: 'Cater with Us', description: 'Cater your next event with us', btnTitle: "Contact Us" },
];

export function CarTiles() {
    return (
        <div className="grid grid-cols-3 gap-4 w-full">
            {tiles.map((tile, index) => (
                <div
                    key={index}
                    className="bg-white rounded-lg shadow-md overflow-hidden transition-transform hover:scale-105 flex flex-col"
                >
                    <img src={tile.image} alt={tile.name} className="w-full h-40 object-cover" />
                    <div className="p-4 flex-grow">
                        <h3 className="font-bold text-lg mb-1">{tile.name}</h3>
                        <p className="text-gray-600 text-sm">{tile.description}</p>
                        {tile.promotion && <p className="text-red-500 font-semibold text-sm mt-2">{tile.promotion}</p>}
                    </div>
                    <div className="p-4 flex justify-end">
                        <Button variant="contained" color="inherit">
                            {tile.btnTitle}
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
}