import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';

interface MenuItem {
    name: string;
    description: string;
    category: string;
    price?: number;
}

const menuItems: MenuItem[] = [
    // Appetizers (15 / 15)
    {
        name: "Satay Chicken",
        description: "Grilled chicken skewers (4) served with a peanut sauce and a cucumber salad.",
        category: "Appetizers"
    },
    {
        name: "Pot Stickers",
        description: "Pan-seared dumplings (5) filled with pork and vegetables, accompanied by a savory dipping sauce.",
        category: "Appetizers"
    },
    {
        name: "Golden Tofu",
        description: "Lightly battered deep-fried tofu (8) with a golden exterior and a soft, flavorful center, served with peanut sauce.",
        category: "Appetizers"
    },
    {
        name: "Golden Eggplant",
        description: "Panko breaded eggplant (5) fried to a crisp golden color served with our signature sweet chili sauce.",
        category: "Appetizers"
    },
    {
        name: "Fried Egg Rolls",
        description: "Deep-fried egg rolls (4) filled with pork, cabbage, vegetables, noodles, and served with sweet and sour sauce.",
        category: "Appetizers"
    },
    {
        name: "Roti & Two Curry Sauce",
        description: "Indian flatbread served with green curry and peanut sauce.",
        category: "Appetizers"
    },
    {
        name: "Fish Cakes",
        description: "Thai-style fish cakes (5) made with Thai herbs and spices, crispy outside, tender inside.",
        category: "Appetizers"
    },
    {
        name: "Crab Rangoons",
        description: "Crab and cream cheese filling in a wonton (6) fried and served with sweet chili sauce.",
        category: "Appetizers"
    },
    {
        name: "Samosa",
        description: "Egg rolls (4) filled with a blend of potatoes, peas, and herbs, served with Thaiphoon's signature peanut sauce.",
        category: "Appetizers"
    },
    {
        name: "Tamarind Chicken Wings",
        description: "Battered wings (6) tossed in a sweet, tangy tamarind sauce, with crispy shallots.",
        category: "Appetizers"
    },
    {
        name: "Lettuce Wraps",
        description: "Wok-seared ground meat with bell peppers, onion, water chestnut, and shiitake served in lettuce cups.",
        category: "Appetizers"
    },
    {
        name: "Fried Calamari",
        description: "Crispy calamari lightly coated in a light crisp batter, served with a side of sweet chili sauce.",
        category: "Appetizers"
    },
    {
        name: "BBQ Prawn Skewers",
        description: "Grilled prawns on skewers accompanied with bell peppers, onions, and pineapple served with a chili-lime sauce.",
        category: "Appetizers"
    },
    {
        name: "Fresh Spring Rolls Veggie",
        description: "Freshly rolled rice wrapper with rice noodles, carrot, spinach, lettuce, basil, cilantro served with Hoisin-chili sauce and peanuts.",
        category: "Appetizers"
    },
    {
        name: "Golden Prawns",
        description: "Panko battered prawns (5) fried to a golden color served with a signature sweet and sour dipping sauce.",
        category: "Appetizers"
    },
    {
        name: "Chinese Chicken Salad",
        description: "Chicken, lettuce, spring mix, wontons, carrots, and cilantro tossed with sesame and served with a soy-based dressing.",
        category: "Salad"
    },
    {
        name: "Green Papaya Salad",
        description: "Prawns, shredded green papaya, lime, fish sauce, chili, tomato and peanuts.",
        category: "Salad"
    },
    {
        name: "Thai Salad",
        description: "Lettuce, spring mix, tomatoes, cucumbers, and red onions served with Thaiphoon's signature peanut sauce.",
        category: "Salad"
    },
    {
        name: "Mango Prawns Salad",
        description: "Fresh mango & prawns in a spicy lime dressing with mint, cilantro, red onion, romaine, and lettuce.",
        category: "Salad"
    },
    {
        name: "Roasted Eggplant Salad",
        description: "Tender-roasted eggplant with lime, garlic, and chili dressing served with spinach, red onions, and mint.",
        category: "Salad"
    },
    {
        name: "Ruby Grapefruit Salad",
        description: "Red cabbage, grapefruit, jicama, and mint, combined with chopped peanuts and tossed in a light Asian vinaigrette dressing.",
        category: "Salad"
    },
    {
        name: "Spicy NY Steak Salad",
        description: "Marinated New York steak slices with lime, lettuce, mint leaves, roasted chili oil, and red onion.",
        category: "Salad"
    },
    {
        name: "Laab Salad",
        description: "Ground chicken seasoned with lime, chili pepper sauce, rice-powder, mint leaves, and peanuts.",
        category: "Salad"
    },
    {
        name: "Grilled Salmon Salad",
        description: "Grilled salmon, jicama, and mint tossed with romaine and lettuce served with lime juice, chili powder, red onions, and cilantro.",
        category: "Salad"
    },
    {
        name: "Tom Yum Soup",
        description: "Mushrooms and cilantro, simmered in a hot and sour broth infused with lime juice, lemongrass, and roasted pepper.",
        category: "Soup"
    },
    {
        name: "Tom Kha Soup",
        description: "Mushrooms and cilantro, simmered in a rich and sweet coconut broth infused with lime juice and lemongrass.",
        category: "Soup"
    },
    {
        name: "Won Ton Soup",
        description: "Homemade broth with spinach, chicken wontons, green onion, and garlic.",
        category: "Soup"
    },
    {
        name: "Thai Rice Soup",
        description: "Rice in a garlic soup broth with chicken meatball, cilantro, green onion, and ginger.",
        category: "Soup"
    },
    {
        name: "Miso Tofu Soup",
        description: "Dashi broth combined with white miso paste, soft tofu, green onions, and nori.",
        category: "Soup"
    },
    {
        name: "Salmon Green Curry",
        description: "Salmon simmered with green curry, shiitake mushrooms, bell peppers, peas, carrots, and basil.",
        category: "Signature Dishes"
    },
    {
        name: "Mongolian Beef",
        description: "Wok-seared steak medallions on watercress, pickled vegetables, with tangy sauce.",
        category: "Signature Dishes"
    },
    {
        name: "Lychee Curry Prawns",
        description: "Prawns simmered with red curry, coconut milk, bell pepper, lychees, peas, carrots, and basil.",
        category: "Signature Dishes"
    },
    {
        name: "Roasted Duck Curry",
        description: "Roasted duck simmered in red curry, tomato, eggplant, pineapple, bell peppers, and basil.",
        category: "Signature Dishes"
    },
    {
        name: "Shaken Beef",
        description: "Pan-fried sliced beef with garlic, onion, chili peppers, topped with crispy rice noodles.",
        category: "Signature Dishes"
    },
    {
        name: "Prawns Chu Chee",
        description: "Panang curry prawns with coconut milk, bell peppers, peas, and kaffir-lime leaves.",
        category: "Signature Dishes"
    },
    {
        name: "Fried Trout Mango Salsa",
        description: "Fried trout paired with a side of spicy mango salsa with lime, mango, onion, chili, fish sauce, cilantro.",
        category: "Signature Dishes"
    },
    {
        name: "Seafood Thai Basil",
        description: "Sautéed shrimps, scallops, and calamari with garlic, sweet onion, peppers, and Thai basil.",
        category: "Signature Dishes"
    },
    {
        name: "Lamb Saag",
        description: "Marinated leg of lamb, cubed, and braised with spinach, seasoned with ginger, garlic, and cumin.",
        category: "Signature Dishes"
    },
    {
        name: "Pumpkin Red Curry Chicken",
        description: "Simmered Kabocha Pumpkin in red curry, chicken, green beans, peas, and bell peppers.",
        category: "Signature Dishes"
    },
    {
        name: "Mus-a-Mun Chicken",
        description: "Thai spices simmered in coconut milk flavored with cumin, turmeric, and served with potatoes, onions, and tomato.",
        category: "Signature Dishes"
    },
    {
        name: "Thai Basil",
        description: "Thai spices simmered in coconut milk flavored with lemongrass, kaffir leaves, served with peas, carrots, green beans, and bell pepper.",
        category: "Signature Dishes"
    },
    {
        name: "Red Curry & Bamboo",
        description: "Thai spices of chili, lemongrass, ginger simmered in coconut milk, bamboo, basil, and red bell peppers.",
        category: "Signature Dishes"
    },
    {
        name: "Jalapeño Pepper Garlic",
        description: "Stir-fried jalapeños, mushrooms, bell peppers, sweet onion, garlic, and oyster sauce.",
        category: "Signature Dishes"
    },
    {
        name: "Garlic & Black Pepper Stir Fry",
        description: "Sautéed with garlic, mushrooms, broccoli, Thai herbs, black pepper, and cilantro.",
        category: "Wok"
    },
    {
        name: "Eggplant Stir Fry",
        description: "Eggplant stir-fried with mushroom, bell peppers, onion, garlic, basil, and chili sauce.",
        category: "Wok"
    },
    {
        name: "Kung Pao",
        description: "Sautéed with bell peppers, onion, water chestnut, scallion, chili, and peanuts.",
        category: "Wok"
    },
    {
        name: "Sweet & Sour Stir Fry",
        description: "Sautéed cucumber, onion, tomatoes, bell pepper, and pineapple in our signature sweet and sour sauce.",
        category: "Wok"
    },
    {
        name: "Broccoli & Mushroom",
        description: "Sautéed with shiitake mushrooms, broccoli, and oyster sauce, served in a flavorful and savory gravy sauce.",
        category: "Wok"
    },
    {
        name: "Green Bean Prig Khing",
        description: "Sautéed with red curry, green beans, kaffir lime leaves and Thai spices.",
        category: "Wok"
    },
    {
        name: "Thai Basil Stir Fry",
        description: "Sautéed with garlic, onion, bell peppers, and Thai basil.",
        category: "Wok"
    },
    {
        name: "Lemongrass Chicken",
        description: "Stir-fried chicken with lemongrass, ginger, green beans, mushrooms, and red bell peppers.",
        category: "Wok"
    },
    {
        name: "Jalapeño Pepper Stir Fry",
        description: "Stir-fried with jalapeños, mushrooms, bell peppers, sweet onion, and oyster sauce.",
        category: "Wok"
    },
    {
        name: "Red Curry",
        description: "Thai spices and red curry simmered in coconut milk with bamboo, basil, and bell peppers.",
        category: "Curry"
    },
    {
        name: "Green Curry",
        description: "Thai spices and mild green chilies simmered in coconut milk, served with peas, carrots, bell pepper, eggplant, and basil.",
        category: "Curry"
    },
    {
        name: "Panang Curry",
        description: "Panang curry paste, coconut milk, bell peppers, and kaffir lime leaves, creating a creamy and flavorful curry.",
        category: "Curry"
    },
    {
        name: "Pumpkin Curry",
        description: "Simmered Kabocha pumpkin, red curry, chicken, green beans, peas, and bell peppers.",
        category: "Curry"
    },
    {
        name: "Mus-a-Mun Curry",
        description: "Thai spices simmered in coconut milk flavored with cumin, turmeric, and served with potatoes, onions, and tomato.",
        category: "Curry"
    },
    {
        name: "Pad Thai",
        description: "Rice noodles stir-fried with egg, bean sprouts, peanuts, and tamarind sauce.",
        category: "Noodles"
    },
    {
        name: "Pad See Ew",
        description: "Wide rice noodles stir-fried with broccoli, egg, and our special house sauce.",
        category: "Noodles"
    },
    {
        name: "Drunken Noodles",
        description: "Pan-fried wide rice noodles sautéed with garlic, chili, broccoli, red bell pepper, and basil.",
        category: "Noodles"
    },
    {
        name: "Singapore Noodles",
        description: "Thin rice noodles stir-fried with egg, green onions, and bean sprouts in a sweet, savory, and tangy sauce.",
        category: "Noodles"
    },
    {
        name: "Beef Noodle Soup",
        description: "Sliced beef with rice noodles in a savory beef broth, topped with bean sprouts, cilantro, and green onions.",
        category: "Noodles"
    },
    {
        name: "Pad Woon Sen",
        description: "Pan-fried bean thread (silver noodles) with egg, bean sprouts, onions, tomatoes, and green onions.",
        category: "Noodles"
    },
    {
        name: "Kao Soi",
        description: "Kao Soi curry, egg noodles, bean sprouts, red onion, roasted chili, mustard green, and crispy egg noodle.",
        category: "Noodles"
    },
    {
        name: "Noodles Green Curry",
        description: "Egg noodles with green curry sauce, eggplants, bell pepper, peas, carrots, and basil.",
        category: "Noodles"
    },
    {
        name: "Spicy Chicken Noodle Soup",
        description: "Ground chicken and shrimps, bean sprouts, green onion, crushed peanut, chili, lime juice, and cilantro.",
        category: "Noodles"
    },
    {
        name: "Tom Yum Prawns Noodle Soup",
        description: "Hot & sour spicy soup with egg noodles, prawns, tofu, mushroom, lime, cilantro, and lemongrass.",
        category: "Noodles"
    },
    {
        name: "Chow Mein",
        description: "Egg noodles stir-fried with bok choy, carrot, broccoli, tomato, bean sprouts, and green onion.",
        category: "Noodles"
    },

    // Fried Rice (4 / 4)
    {
        name: "Pineapple Cashew Fried Rice",
        description: "Pan-fried rice with cashews, pineapples, onions, peppers, and cilantro.",
        category: "Fried Rice"
    },
    {
        name: "Spicy Basil Fried Rice",
        description: "Pan-fried rice with Thai basil, bell peppers, onion, garlic, and chili.",
        category: "Fried Rice"
    },
    {
        name: "Crab & Prawns Fried Rice",
        description: "Crab & prawns pan-fried with rice, egg, onions, green onion, tomato, carrot, and cilantro.",
        category: "Fried Rice"
    },
    {
        name: "Thaiphoon House Fried Rice",
        description: "Signature fried rice sauce and rice pan-fried with egg, onion, green onions, tomato, carrot, and cilantro.",
        category: "Fried Rice"
    },

    // Grill (3 / 3)
    {
        name: "BBQ Chicken",
        description: "Grilled marinated chicken served with homemade Thai spicy sweet and sour BBQ sauce.",
        category: "Grill"
    },
    {
        name: "BBQ Pork Chop",
        description: "Grilled marinated pork chop with homemade Thai spicy sweet and sour BBQ sauce.",
        category: "Grill"
    },
    {
        name: "BBQ Pork Ribs",
        description: "Baby pork ribs marinated in hoisin-honey and coriander; sides with cucumber salad and sweet chili sauce.",
        category: "Grill"
    },

    // Sides (10 / 10)
    {
        name: "Sticky Rice",
        description: "Steamed sticky rice, a traditional Thai side.",
        category: "Sides"
    },
    {
        name: "Steamed Rice Noodles",
        description: "Soft rice noodles served as a side.",
        category: "Sides"
    },
    {
        name: "Brown Jasmine Rice",
        description: "Steamed brown jasmine rice, an earthy and healthy option.",
        category: "Sides"
    },
    {
        name: "Coconut Jasmine Rice",
        description: "Jasmine rice infused with the sweet flavor of coconut milk.",
        category: "Sides"
    },
    {
        name: "Peanut Sauce",
        description: "Rich and creamy peanut sauce, available in small or large servings.",
        category: "Sides"
    },
    {
        name: "Steamed Broccoli",
        description: "Fresh broccoli steamed to perfection.",
        category: "Sides"
    },
    {
        name: "Steamed Veggies",
        description: "A medley of fresh steamed vegetables.",
        category: "Sides"
    },
    {
        name: "White Jasmine Rice",
        description: "Steamed fluffy white jasmine rice.",
        category: "Sides"
    },
    {
        name: "Roti Bread",
        description: "Indian-style flatbread served warm.",
        category: "Sides"
    },
    {
        name: "Cucumber Salad",
        description: "Crisp cucumber slices tossed in a light vinegar-based dressing.",
        category: "Sides"
    }
];


export async function seedMenu() {
    try {
        // First get all existing menu items
        const querySnapshot = await getDocs(collection(db, 'menu'));
        const existingItems = querySnapshot.docs.map(doc => doc.data().name);

        for (const item of menuItems) {
            // Check if item already exists
            if (!existingItems.includes(item.name)) {
                await addDoc(collection(db, 'menu'), {
                    ...item,
                    price: item?.price || 0,
                });
                (`Added ${item.name} to menu collection`);
            } else {
                (`Skipped ${item.name} - already exists`);
            }
        }
        ('Menu seeding completed!');
    } catch (error) {
        console.error('Error seeding menu:', error);
    }
}

// You can call this function from your browser console
// @ts-ignore
window.seedMenu = seedMenu;
