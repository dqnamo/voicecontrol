import react from "@astrojs/react";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  adapter: vercel(),
  integrations: [react()],
  output: "server",
  vite: {
    plugins: [tailwindcss()],
  },
});
