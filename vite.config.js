import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // ローカルプレビューおよびGitHub Pagesのパス競合を回避するために相対パスを指定
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
});
