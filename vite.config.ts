import { defineConfig } from "vite";
import { tanstackRouterGenerator } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tanstackRouterGenerator(), react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
  },
  ssr: {
    noExternal: ["@supabase/supabase-js"],
  },
  appType: "spa",
});
