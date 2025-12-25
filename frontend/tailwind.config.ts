import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Lexend Deca", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        // Main backgrounds
        "bg-main": "#0E1218",
        "bg-card": "#0A0D12",
        "bg-input": "#1F242E",
        "bg-button": "#20262F",
        "bg-dark": "#1D222B",
        "bg-total": "#15191F",
        
        // Border
        "border-card": "#272C35",
        "stroke": "rgba(109, 119, 135, 0.2)",
        "stroke-swap": "#59626F",
        
        // Chain colors
        fantom: "#1A6AFF",
        kava: "#FD4C45",
        
        // Text
        "text-primary": "#FCFCFC",
        "text-secondary": "#AFB6C9",
        "text-muted": "#7B8187",
        "text-dim": "#A7A7A7",
        
        // Accents
        "accent-primary": "#5D93B2",
        "accent-success": "#638E5D",
      },
      borderRadius: {
        "xl": "12px",
        "2xl": "16px",
        "3xl": "24px",
      },
      fontSize: {
        "xxs": ["10px", "12px"],
      },
      boxShadow: {
        "card": "0px 4px 4px rgba(0, 0, 0, 0.25)",
        "swap": "0px 4px 20px rgba(60, 69, 78, 0.3)",
        "cta": "0px 5px 13px -4px rgba(169, 182, 191, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
