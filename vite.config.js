import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // GitHub Pages 저장소명이 달라도 동작하기 쉽게 상대 경로 사용
  base: "./",
});
