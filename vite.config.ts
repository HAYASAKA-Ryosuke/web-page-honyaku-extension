import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest";
import { resolve, dirname } from "path";
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig(({ mode }) => {
  const isFirefox = mode === "firefox";
  
  return {
    plugins: [
      // Chrome用の場合は@crxjs/vite-pluginを使用
      !isFirefox && crx({ manifest }),
      // Firefox用の場合はpopup.htmlをコピーし、popup.tsのパスを修正するプラグイン
      isFirefox && {
        name: "firefox-assets",
        closeBundle() {
          const distDir = resolve(process.cwd(), "dist-firefox");
          const srcDir = resolve(distDir, "src");
          mkdirSync(srcDir, { recursive: true });
          
          // popup.htmlをコピーし、popup.tsのパスを修正
          const popupSrc = resolve(process.cwd(), "src/popup.html");
          const popupDest = resolve(srcDir, "popup.html");
          if (existsSync(popupSrc)) {
            let popupContent = readFileSync(popupSrc, "utf-8");
            // popup.tsのパスを修正（assets/popup.jsに変更）
            popupContent = popupContent.replace(
              '<script type="module" src="./popup.ts"></script>',
              '<script type="module" src="../assets/popup.js"></script>'
            );
            writeFileSync(popupDest, popupContent);
          }
        }
      }
    ].filter(Boolean),
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      hmr: {
        protocol: "ws",
        host: "127.0.0.1",
        port: 5173
      }
    },
    build: {
      sourcemap: true,
      outDir: isFirefox ? "dist-firefox" : "dist",
      rollupOptions: isFirefox ? {
        input: {
          background: resolve(__dirname, "src/background.ts"),
          content: resolve(__dirname, "src/content.ts"),
          popup: resolve(__dirname, "src/popup.ts"),
        },
        output: {
          entryFileNames: "assets/[name].js",
          chunkFileNames: "assets/[name].js",
        }
      } : undefined
    }
  };
});

