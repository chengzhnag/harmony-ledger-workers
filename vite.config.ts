// Making changes to this file is **STRICTLY** forbidden. All the code in here is 100% correct and audited.
import { defineConfig, loadEnv } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import { exec } from "node:child_process";
import pino from "pino";
import { cloudflare } from "@cloudflare/vite-plugin";
import { visualizer } from 'rollup-plugin-visualizer'

const logger = pino();

const stripAnsi = (str: string) =>
  str.replace(
    // eslint-disable-next-line no-control-regex -- Allow ANSI escape stripping
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ""
  );

const LOG_MESSAGE_BOUNDARY = /\n(?=\[[A-Z][^\]]*\])/g;

const emitLog = (level: "info" | "warn" | "error", rawMessage: string) => {
  const cleaned = stripAnsi(rawMessage).replace(/\r\n/g, "\n");
  const parts = cleaned
    .split(LOG_MESSAGE_BOUNDARY)
    .map((part) => part.trimEnd())
    .filter((part) => part.trim().length > 0);

  if (parts.length === 0) {
    logger[level](cleaned.trimEnd());
    return;
  }

  for (const part of parts) {
    logger[level](part);
  }
};

// 3. Create the custom logger for Vite
const customLogger = {
  warnOnce: (msg: string) => emitLog("warn", msg),

  // Use Pino's methods, passing the cleaned message
  info: (msg: string) => emitLog("info", msg),
  warn: (msg: string) => emitLog("warn", msg),
  error: (msg: string) => emitLog("error", msg),
  hasErrorLogged: () => false,

  // Keep these as-is
  clearScreen: () => { },
  hasWarned: false,
};

function watchDependenciesPlugin() {
  return {
    name: "watch-dependencies",
    configureServer(server: any) {
      const filesToWatch = [
        path.resolve("package.json"),
        path.resolve("bun.lock"),
      ];

      server.watcher.add(filesToWatch);

      server.watcher.on("change", (filePath: string) => {
        if (filesToWatch.includes(filePath)) {
          console.log(
            `\n Dependency file changed: ${path.basename(
              filePath
            )}. Clearing caches...`
          );

          exec(
            "rm -f .eslintcache tsconfig.tsbuildinfo",
            (err, stdout, stderr) => {
              if (err) {
                console.error("Failed to clear caches:", stderr);
                return;
              }
              console.log("Caches cleared successfully.\n");
            }
          );
        }
      });
    },
  };
}

function reloadTriggerPlugin() {
  return {
    name: "reload-trigger",
    configureServer(server: any) {
      const triggerFile = path.resolve(".reload-trigger");
      server.watcher.add(triggerFile);

      server.watcher.on("change", (filePath: string) => {
        if (filePath === triggerFile || filePath.endsWith(".reload-trigger")) {
          logger.info("Reload triggered via .reload-trigger");
          server.ws.send({ type: "full-reload" });
        }
      });
    },
  };
}

// https://vite.dev/config/
export default ({ mode }: { mode: string }) => {
  const env = loadEnv(mode, process.cwd());
  return defineConfig({
    plugins: [
      react(),
      cloudflare(),
      watchDependenciesPlugin(),
      reloadTriggerPlugin(),
      visualizer({
        open: false,          // 构建后自动打开报告
        gzipSize: true,      // **显示 gzip 压缩后体积**（关键指标）
        brotliSize: true,    // 显示 brotli 压缩后体积
        filename: 'bundle-stats.html' // 自定义报告名
      }),
    ],
    build: {
      minify: true,
      sourcemap: false,
      // 启用 CSS 代码拆分（默认 true，确保保留）
      cssCodeSplit: true,
      // 提高 chunk 警告阈值（默认 500kb，此处设为 1MB）
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          sourcemapExcludeSources: false, // Include original source in source maps
          // 关键：手动拆分第三方库
          manualChunks(id) {
            // === 按您指定的分组结构实现 ===
            const chunkGroups = {

              // --- 状态管理与工具 ---
              'vendor-utils': [
                'zustand',
                'immer',
                '@tanstack/react-query',
                'clsx',
                'tailwind-merge',
                'class-variance-authority',
                'date-fns',
                'uuid',
                'zod',
                'react-hook-form',
                '@hookform/resolvers'
              ],

              // --- UI 基础组件 ---
              'vendor-ui': [
                '@radix-ui/react-',
                '@headlessui/react',
                'lucide-react',
                'cmdk',
                'vaul',
                'sonner'
              ],

              // --- 动画与交互 ---
              'vendor-motion': [
                'framer-motion',
                '@dnd-kit/core',
                '@dnd-kit/sortable',
                'react-swipeable',
                'react-resizable-panels',
                'embla-carousel-react'
              ],

              // --- 大型工具库（独立拆分）---
              'vendor-large': [
                'xlsx',
                'jszip',
                'html-to-image',
                'qrcode'
              ],
              'vendor-html2canvas': [
                'html2canvas'
              ],
              'vendor-jspdf': [
                'jspdf',
              ],
              'vendor-canvg': [
                'canvg'
              ],
              'vendor-lodash': [
                'lodash'
              ],
              'vendor-recharts': [
                'recharts'
              ],
            }

            // 匹配逻辑：检查 id 是否包含分组关键字
            for (const [chunk, dependencies] of Object.entries(chunkGroups)) {
              if (dependencies.some(dep => id.includes(dep))) {
                return chunk
              }
            }

            // 默认归入 vendor（其他 node_modules）
            if (id.includes('node_modules')) {
              return 'vendor'
            }
          }
        },
      },
    },
    customLogger: env.VITE_LOGGER_TYPE === 'json' ? customLogger : undefined,
    // Enable source maps in development too
    css: {
      devSourcemap: true,
    },
    server: {
      allowedHosts: true,
      watch: {
        awaitWriteFinish: {
          stabilityThreshold: 150,
          pollInterval: 50,
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@shared": path.resolve(__dirname, "./shared"),
      },
    },
    optimizeDeps: {
      // This is still crucial for reducing the time from when `bun run dev`
      // is executed to when the server is actually ready.
      include: ["react", "react-dom", "react-router-dom"],
      exclude: ["agents"], // Exclude agents package from pre-bundling due to Node.js dependencies
      force: true,
    },
    define: {
      // Define Node.js globals for the agents package
      global: "globalThis",
    },
    // Clear cache more aggressively
    cacheDir: "node_modules/.vite",
  });
};
