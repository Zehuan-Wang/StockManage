import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? "").split("/");
const base = repo && repo !== `${owner}.github.io` ? `/${repo}/` : "/";

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
});
