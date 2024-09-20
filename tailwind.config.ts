import type { Config } from "tailwindcss";

const config: Config = {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./components/**/*.{js,ts,jsx,tsx,mdx}",
		"./app/**/*.{js,ts,jsx,tsx,mdx}",
	],
	theme: {
		extend: {
			colors: {
				background: 'var(--background)',
				foreground: 'var(--foreground)'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			}
		},
		animation: {
			meteor: "meteor 5s linear infinite",
			"border-beam": "border-beam calc(var(--duration)*1s) infinite linear",
			gradient: "gradient 8s linear infinite",
		},
		keyframes: {
			meteor: {
				"0%": { transform: "rotate(215deg) translateX(0)", opacity: "1" },
				"70%": { opacity: "1" },
				"100%": {
					transform: "rotate(215deg) translateX(-500px)",
					opacity: "0",
				},
			},
			"border-beam": {
				"100%": {
					"offset-distance": "100%",
				},
			},
			gradient: {
				to: {
					backgroundPosition: "var(--bg-size) 0",
				},
			},
		},
	},
	plugins: [require("tailwindcss-animate")],
};
export default config;
