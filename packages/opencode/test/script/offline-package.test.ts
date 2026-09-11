import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { TextWriter, Uint8ArrayReader, ZipReader } from "@zip.js/zip.js"
import { createOfflineLinuxPackage, createTarHeader } from "../../script/offline-package"
import { createOfflineWindowsPackage } from "../../script/offline-windows-package"
import { tmpdir } from "../fixture/fixture"

describe("offline Linux package", () => {
  test("writes executable modes into POSIX tar headers", () => {
    const header = createTarHeader({
      name: "hypercode/install.sh",
      mode: 0o755,
      size: 10,
      type: "file",
    })

    expect(header.subarray(100, 108).toString("ascii")).toBe("0000755\0")
    expect(header.subarray(257, 263).toString("ascii")).toBe("ustar\0")
    expect(header.subarray(156, 157).toString("ascii")).toBe("0")
  })

  test("writes directory entries with directory type", () => {
    const header = createTarHeader({
      name: "hypercode/bin",
      mode: 0o755,
      size: 0,
      type: "directory",
    })

    expect(header.subarray(156, 157).toString("ascii")).toBe("5")
  })

  test("rejects paths that cannot fit in the tar name field", () => {
    expect(() =>
      createTarHeader({
        name: "x".repeat(101),
        mode: 0o644,
        size: 0,
        type: "file",
      }),
    ).toThrow("Tar path is too long")
  })

  test("creates an offline archive with checksums and executable modes", async () => {
    await using tmp = await tmpdir()
    const standard = path.join(tmp.path, "standard")
    const baseline = path.join(tmp.path, "baseline")
    await Promise.all([Bun.write(standard, "standard-binary"), Bun.write(baseline, "baseline-binary")])

    const result = await createOfflineLinuxPackage({
      version: "1.17.3",
      outputDir: tmp.path,
      standardBinary: standard,
      baselineBinary: baseline,
    })
    const listing = await Bun.$`tar -tvzf ${result.archive}`.text()
    const names = await Bun.$`tar -tzf ${result.archive}`.text()
    const readme = await Bun.$`tar -xOzf ${result.archive} ${result.root}/README.zh-CN.md`.text()

    expect(names).toContain(`${result.root}/bin/hypercode`)
    expect(names).toContain(`${result.root}/bin/hypercode-baseline`)
    expect(names).toContain(`${result.root}/install.sh`)
    expect(names).toContain(`${result.root}/install-license.sh`)
    expect(names).toContain(`${result.root}/config/hypercode.json.example`)
    expect(names).toContain(`${result.root}/config/hypercode.env.example`)
    expect(names).toContain(`${result.root}/README.zh-CN.md`)
    expect(names).toContain(`${result.root}/SHA256SUMS`)
    expect(listing).toContain("-rwxr-xr-x")
    expect(readme).toContain(
      "[ -e ~/.config/opencode/hypercode.json ] || cp config/hypercode.json.example ~/.config/opencode/hypercode.json",
    )
    expect(readme).toContain(
      "[ -e ~/.config/opencode/hypercode.env ] || cp config/hypercode.env.example ~/.config/opencode/hypercode.env",
    )
    expect(await fs.readFile(result.checksum, "utf8")).toMatch(/^[0-9a-f]{64}  hypercode-offline-/)
  })
})

describe("offline Windows package", () => {
  test("creates a self-contained archive with installer, VSIX, configs, and checksums", async () => {
    await using tmp = await tmpdir()
    const standard = path.join(tmp.path, "standard.exe")
    const baseline = path.join(tmp.path, "baseline.exe")
    const extension = path.join(tmp.path, "hypercode.vsix")
    const vscodeInstaller = path.join(tmp.path, "VSCodeSetup.exe")
    await Promise.all([
      Bun.write(standard, "standard-binary"),
      Bun.write(baseline, "baseline-binary"),
      Bun.write(extension, "extension"),
      Bun.write(vscodeInstaller, "vscode-installer"),
    ])

    const result = await createOfflineWindowsPackage({
      version: "1.17.3",
      outputDir: tmp.path,
      standardBinary: standard,
      baselineBinary: baseline,
      extension,
      vscodeInstaller,
    })
    const reader = new ZipReader(new Uint8ArrayReader(new Uint8Array(await Bun.file(result.archive).arrayBuffer())))
    const entries = await reader.getEntries()
    const names = entries.map((entry) => entry.filename)
    const installer = entries.find((entry) => entry.filename === `${result.root}/install.ps1`)
    const readme = entries.find((entry) => entry.filename === `${result.root}/README.zh-CN.md`)
    const checksums = entries.find((entry) => entry.filename === `${result.root}/SHA256SUMS.txt`)

    expect(names).toContain(`${result.root}/bin/standard/hypercode.exe`)
    expect(names).toContain(`${result.root}/bin/baseline/hypercode.exe`)
    expect(names).toContain(`${result.root}/extension/hypercode.vsix`)
    expect(names).toContain(`${result.root}/installers/VSCodeSetup.exe`)
    expect(names).toContain(`${result.root}/config/minimax-direct.json`)
    expect(names).toContain(`${result.root}/config/internal-openai-compatible.json.example`)
    const installerText = await installer?.getData?.(new TextWriter())
    expect(installerText).toContain("HYPERCODE_DISABLE_MODELS_FETCH")
    expect(installerText).toContain("--install-extension")
    expect(installerText).toContain('"/CURRENTUSER"')
    expect(installerText).toContain("VS Code installation failed with exit code")
    expect(await readme?.getData?.(new TextWriter())).toContain("无法访问外网的虚拟机")
    expect(await checksums?.getData?.(new TextWriter())).toContain("extension/hypercode.vsix")
    expect(await fs.readFile(result.checksum, "utf8")).toMatch(/^[0-9a-f]{64}  hypercode-offline-windows-/)

    const parser = Bun.spawn({
      cmd: [
        "powershell.exe",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$tokens=$null;$errors=$null;[System.Management.Automation.Language.Parser]::ParseInput([Console]::In.ReadToEnd(),[ref]$tokens,[ref]$errors)|Out-Null;if($errors.Count){$errors|ForEach-Object{Write-Error $_};exit 1}",
      ],
      stdin: new Blob([installerText ?? ""]),
      stdout: "pipe",
      stderr: "pipe",
    })
    expect(await parser.exited, await new Response(parser.stderr).text()).toBe(0)

    const sourceSelection = installerText?.match(
      /\$Source = if \(\$Variant -eq "Standard"\) \{[\s\S]*?\r?\n\} else \{[\s\S]*?\r?\n\}/,
    )?.[0]
    expect(sourceSelection).toBeDefined()
    const sourceScript = path.join(tmp.path, "select-source.ps1")
    await Bun.write(
      sourceScript,
      `param([string]$PackageRoot, [string]$Variant)\n${sourceSelection}\n[Console]::Out.Write($Source)\n`,
    )
    for (const variant of ["Standard", "Baseline"] as const) {
      const selector = Bun.spawn({
        cmd: [
          "powershell.exe",
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          sourceScript,
          "-PackageRoot",
          tmp.path,
          "-Variant",
          variant,
        ],
        stdout: "pipe",
        stderr: "pipe",
      })
      const output = new Response(selector.stdout).text()
      expect(await selector.exited, await new Response(selector.stderr).text()).toBe(0)
      expect(await output).toBe(
        path.join(tmp.path, "bin", variant === "Standard" ? "standard" : "baseline", "hypercode.exe"),
      )
    }
    await reader.close()
  })
})
