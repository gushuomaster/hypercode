const esbuild = require("esbuild")
const fs = require("fs")
const path = require("path")

const production = process.argv.includes("--production")
const watch = process.argv.includes("--watch")

function resolveReactAliases() {
  const reactDomPackage = require.resolve("react-dom/package.json")
  const reactDomDir = path.dirname(reactDomPackage)
  const nestedReactDir = path.join(reactDomDir, "node_modules", "react")
  const reactPackage = fs.existsSync(path.join(nestedReactDir, "package.json"))
    ? path.join(nestedReactDir, "package.json")
    : require.resolve("react/package.json")

  return {
    react: path.dirname(reactPackage),
    "react/jsx-runtime": require.resolve("react/jsx-runtime", { paths: [path.dirname(reactPackage)] }),
    "react/jsx-dev-runtime": require.resolve("react/jsx-dev-runtime", { paths: [path.dirname(reactPackage)] }),
    "react-dom": reactDomDir,
    "react-dom/client": require.resolve("react-dom/client", { paths: [reactDomDir] }),
  }
}

const reactAliases = resolveReactAliases()
const sdkAliases = {
  "@opencode-ai/sdk/v2": path.resolve(__dirname, "../../packages/sdk/js/src/v2/index.ts"),
  "@opencode-ai/sdk/v2/client": path.resolve(__dirname, "../../packages/sdk/js/src/v2/client.ts"),
}

const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",
  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started")
    })

    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        if (!location) {
          console.error(`[ERROR] ${text}`)
          return
        }

        console.error(`[ERROR] ${text}`)
        console.error(`    ${location.file}:${location.line}:${location.column}:`)
      })

      console.log("[watch] build finished")
    })
  },
}

async function main() {
  const contexts = await Promise.all([
    esbuild.context({
      entryPoints: ["src/extension.ts"],
      bundle: true,
      format: "cjs",
      alias: sdkAliases,
      minify: production,
      sourcemap: !production,
      sourcesContent: false,
      platform: "node",
      outfile: "dist/extension.js",
      external: ["vscode"],
      logLevel: "silent",
      plugins: [esbuildProblemMatcherPlugin],
    }),
    esbuild.context({
      entryPoints: ["src/panel/webview/index.tsx"],
      bundle: true,
      format: "iife",
      alias: reactAliases,
      minify: production,
      sourcemap: !production,
      sourcesContent: false,
      platform: "browser",
      target: ["es2022"],
      jsx: "automatic",
      entryNames: "panel-webview",
      assetNames: "panel-webview-[name]",
      outdir: "dist",
      loader: {
        ".css": "css",
      },
      logLevel: "silent",
      plugins: [esbuildProblemMatcherPlugin],
    }),
    esbuild.context({
      entryPoints: ["src/sidebar/webview/index.tsx"],
      bundle: true,
      format: "iife",
      alias: reactAliases,
      minify: production,
      sourcemap: !production,
      sourcesContent: false,
      platform: "browser",
      target: ["es2022"],
      jsx: "automatic",
      entryNames: "sidebar-webview",
      assetNames: "sidebar-webview-[name]",
      outdir: "dist",
      loader: {
        ".css": "css",
      },
      logLevel: "silent",
      plugins: [esbuildProblemMatcherPlugin],
    }),
  ])

  if (watch) {
    await Promise.all(contexts.map((context) => context.watch()))
    return
  }

  await Promise.all(contexts.map((context) => context.rebuild()))
  await Promise.all(contexts.map((context) => context.dispose()))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
