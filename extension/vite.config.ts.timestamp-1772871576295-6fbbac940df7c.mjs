// vite.config.ts
import { defineConfig } from "file:///C:/Users/keesi/Documents/GitHub/hackomania26/extension/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/keesi/Documents/GitHub/hackomania26/extension/node_modules/@vitejs/plugin-react/dist/index.js";
import { crx } from "file:///C:/Users/keesi/Documents/GitHub/hackomania26/extension/node_modules/@crxjs/vite-plugin/dist/index.mjs";

// manifest.json
var manifest_default = {
  name: "TruthLens",
  description: "AI-powered misinformation and credibility checker for Singapore's multilingual web",
  version: "0.1.0",
  manifest_version: 3,
  action: {
    default_icon: {
      "128": "truthlens.png"
    }
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module"
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.ts"],
      run_at: "document_idle"
    }
  ],
  side_panel: {
    default_path: "panel.html"
  },
  permissions: [
    "activeTab",
    "storage",
    "sidePanel",
    "contextMenus"
  ],
  host_permissions: [
    "<all_urls>"
  ],
  icons: {
    "128": "truthlens.png"
  }
};

// vite.config.ts
var vite_config_default = defineConfig({
  plugins: [
    react(),
    crx({ manifest: manifest_default })
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAibWFuaWZlc3QuanNvbiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGtlZXNpXFxcXERvY3VtZW50c1xcXFxHaXRIdWJcXFxcaGFja29tYW5pYTI2XFxcXGV4dGVuc2lvblwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxca2Vlc2lcXFxcRG9jdW1lbnRzXFxcXEdpdEh1YlxcXFxoYWNrb21hbmlhMjZcXFxcZXh0ZW5zaW9uXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9rZWVzaS9Eb2N1bWVudHMvR2l0SHViL2hhY2tvbWFuaWEyNi9leHRlbnNpb24vdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xyXG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XHJcbmltcG9ydCB7IGNyeCB9IGZyb20gXCJAY3J4anMvdml0ZS1wbHVnaW5cIjtcclxuaW1wb3J0IG1hbmlmZXN0IGZyb20gXCIuL21hbmlmZXN0Lmpzb25cIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgcGx1Z2luczogW1xyXG4gICAgcmVhY3QoKSxcclxuICAgIGNyeCh7IG1hbmlmZXN0IH0pLFxyXG4gIF0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIG91dERpcjogXCJkaXN0XCIsXHJcbiAgICBlbXB0eU91dERpcjogdHJ1ZSxcclxuICB9LFxyXG59KTtcclxuIiwgIntcclxuICBcIm5hbWVcIjogXCJUcnV0aExlbnNcIixcclxuICBcImRlc2NyaXB0aW9uXCI6IFwiQUktcG93ZXJlZCBtaXNpbmZvcm1hdGlvbiBhbmQgY3JlZGliaWxpdHkgY2hlY2tlciBmb3IgU2luZ2Fwb3JlJ3MgbXVsdGlsaW5ndWFsIHdlYlwiLFxyXG4gIFwidmVyc2lvblwiOiBcIjAuMS4wXCIsXHJcbiAgXCJtYW5pZmVzdF92ZXJzaW9uXCI6IDMsXHJcbiAgXCJhY3Rpb25cIjoge1xyXG4gICAgXCJkZWZhdWx0X2ljb25cIjoge1xyXG4gICAgICBcIjEyOFwiOiBcInRydXRobGVucy5wbmdcIlxyXG4gICAgfVxyXG4gIH0sXHJcbiAgXCJiYWNrZ3JvdW5kXCI6IHtcclxuICAgIFwic2VydmljZV93b3JrZXJcIjogXCJzcmMvYmFja2dyb3VuZC9pbmRleC50c1wiLFxyXG4gICAgXCJ0eXBlXCI6IFwibW9kdWxlXCJcclxuICB9LFxyXG4gIFwiY29udGVudF9zY3JpcHRzXCI6IFtcclxuICAgIHtcclxuICAgICAgXCJtYXRjaGVzXCI6IFtcIjxhbGxfdXJscz5cIl0sXHJcbiAgICAgIFwianNcIjogW1wic3JjL2NvbnRlbnQvaW5kZXgudHNcIl0sXHJcbiAgICAgIFwicnVuX2F0XCI6IFwiZG9jdW1lbnRfaWRsZVwiXHJcbiAgICB9XHJcbiAgXSxcclxuICBcInNpZGVfcGFuZWxcIjoge1xyXG4gICAgXCJkZWZhdWx0X3BhdGhcIjogXCJwYW5lbC5odG1sXCJcclxuICB9LFxyXG4gIFwicGVybWlzc2lvbnNcIjogW1xyXG4gICAgXCJhY3RpdmVUYWJcIixcclxuICAgIFwic3RvcmFnZVwiLFxyXG4gICAgXCJzaWRlUGFuZWxcIixcclxuICAgIFwiY29udGV4dE1lbnVzXCJcclxuICBdLFxyXG4gIFwiaG9zdF9wZXJtaXNzaW9uc1wiOiBbXHJcbiAgICBcIjxhbGxfdXJscz5cIlxyXG4gIF0sXHJcbiAgXCJpY29uc1wiOiB7XHJcbiAgICBcIjEyOFwiOiBcInRydXRobGVucy5wbmdcIlxyXG4gIH1cclxufVxyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWtXLFNBQVMsb0JBQW9CO0FBQy9YLE9BQU8sV0FBVztBQUNsQixTQUFTLFdBQVc7OztBQ0ZwQjtBQUFBLEVBQ0UsTUFBUTtBQUFBLEVBQ1IsYUFBZTtBQUFBLEVBQ2YsU0FBVztBQUFBLEVBQ1gsa0JBQW9CO0FBQUEsRUFDcEIsUUFBVTtBQUFBLElBQ1IsY0FBZ0I7QUFBQSxNQUNkLE9BQU87QUFBQSxJQUNUO0FBQUEsRUFDRjtBQUFBLEVBQ0EsWUFBYztBQUFBLElBQ1osZ0JBQWtCO0FBQUEsSUFDbEIsTUFBUTtBQUFBLEVBQ1Y7QUFBQSxFQUNBLGlCQUFtQjtBQUFBLElBQ2pCO0FBQUEsTUFDRSxTQUFXLENBQUMsWUFBWTtBQUFBLE1BQ3hCLElBQU0sQ0FBQyxzQkFBc0I7QUFBQSxNQUM3QixRQUFVO0FBQUEsSUFDWjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFlBQWM7QUFBQSxJQUNaLGNBQWdCO0FBQUEsRUFDbEI7QUFBQSxFQUNBLGFBQWU7QUFBQSxJQUNiO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsRUFDRjtBQUFBLEVBQ0Esa0JBQW9CO0FBQUEsSUFDbEI7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsRUFDVDtBQUNGOzs7QUQvQkEsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sSUFBSSxFQUFFLDJCQUFTLENBQUM7QUFBQSxFQUNsQjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsYUFBYTtBQUFBLEVBQ2Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
