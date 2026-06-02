import { defineManifest } from "@crxjs/vite-plugin";


export default defineManifest({
  manifest_version: 3,
  name: "translation-extension",
  description: "",
  version: "1.3.0",
  action: {
    default_title: "translation-extension",
    default_popup: "src/popup.html"
  },
  background: {
    service_worker: "src/background.ts",
    type: "module"
  },
  content_scripts: [
    {
      matches: ["https://*/*"],
      js: ["src/content.ts"],
      run_at: "document_idle"
    }
  ],
  permissions: ["storage", "contextMenus", "activeTab", "clipboardRead", "clipboardWrite"],
  host_permissions: ["https://api.anthropic.com/*"]
});
