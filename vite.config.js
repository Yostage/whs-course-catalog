import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Set base to "./" for GitHub Pages compatibility with any repo name.
  // If deploying to a subpath like /whs-course-catalog/, change to that value.
  base: "./",
});
