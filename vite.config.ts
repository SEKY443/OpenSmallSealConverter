import { readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

/** The only font files cleared for redistribution (see NOTICE). */
const PUBLISHED_FONTS = new Set(["chongxi.otf", "chongxi.coverage.json"]);

/**
 * Strip any other file from dist/fonts, so a font dropped into public/fonts
 * for local testing is never published by accident.
 */
function publishClearedFontsOnly(): Plugin {
  let outDir = "dist";
  return {
    name: "publish-cleared-fonts-only",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const fontsDir = resolve(outDir, "fonts");
      for (const file of await readdir(fontsDir).catch(() => [] as string[])) {
        if (PUBLISHED_FONTS.has(file)) continue;
        await rm(resolve(fontsDir, file), { force: true });
        if (!file.startsWith(".")) this.warn(`fonts/${file} is not cleared for redistribution; excluded from the build.`);
      }
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [publishClearedFontsOnly()],
});
