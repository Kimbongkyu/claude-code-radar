import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 프로젝트 주소(/claude-code-radar/)에 맞춘 기본 경로
export default defineConfig({
  base: process.env.BASE_PATH ?? '/claude-code-radar/',
  plugins: [react()],
});
