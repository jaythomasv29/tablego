"use client"
import React from 'react';
import { motion } from 'framer-motion';

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

export default function StaggeredList({ children }: { children: React.ReactNode }) {
    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
        >
            {React.Children.map(children, child => (
                <motion.div variants={item}>
                    {child}
                </motion.div>
            ))}
        </motion.div>
    );
} 