import hashlib
from datetime import date, timedelta
import tkinter as tk
from tkinter import filedialog, messagebox, ttk


SECRET_KEY = "hyper-aicode-secret-2024"
DURATION_DAYS = {
    "永久": None,
    "15 天": 15,
    "30 天": 30,
    "90 天": 90,
}


def normalize_machine_id(machine_id: str) -> str:
    normalized = machine_id.strip()
    if not normalized:
        raise ValueError("请输入机器 ID。")
    return normalized


def calculate_checksum(data: str) -> str:
    return str(sum(ord(character) for character in data) % 1000).zfill(3)


def format_license(core: str, checksum: str | None = None) -> str:
    groups = "-".join(core[index : index + 4] for index in range(0, len(core), 4))
    return f"{groups}-{checksum or calculate_checksum(core)}"


def generate_license(machine_id: str, expiry: date | None = None) -> str:
    normalized = normalize_machine_id(machine_id)
    expiry_value = expiry.strftime("%Y%m%d") if expiry else ""
    source = f"{normalized}-{SECRET_KEY}-{expiry_value}" if expiry else f"{normalized}-{SECRET_KEY}"
    core = hashlib.sha256(source.encode("utf-8")).hexdigest()[:32]
    formatted = format_license(core)
    return f"{formatted}-{expiry_value}" if expiry else formatted


def generate_timed_license(machine_id: str, days: int, today: date | None = None) -> tuple[str, date]:
    if days not in (15, 30, 90):
        raise ValueError(f"不支持的授权期限：{days} 天。")
    expiry = (today or date.today()) + timedelta(days=days)
    return generate_license(machine_id, expiry), expiry


def create_window() -> tk.Tk:
    root = tk.Tk()
    root.title("HyperCode License 签发工具")
    root.geometry("720x360")
    root.minsize(680, 340)

    content = ttk.Frame(root, padding=24)
    content.grid(row=0, column=0, sticky="nsew")
    root.columnconfigure(0, weight=1)
    root.rowconfigure(0, weight=1)
    content.columnconfigure(1, weight=1)

    machine_id = tk.StringVar()
    duration = tk.StringVar(value="永久")
    result = tk.StringVar()
    status = tk.StringVar(value="请输入目标机器 ID 并选择授权期限。")

    ttk.Label(content, text="机器 ID").grid(row=0, column=0, padx=(0, 12), pady=(0, 14), sticky="w")
    machine_entry = ttk.Entry(content, textvariable=machine_id)
    machine_entry.grid(row=0, column=1, columnspan=2, pady=(0, 14), sticky="ew")

    ttk.Label(content, text="授权期限").grid(row=1, column=0, padx=(0, 12), pady=(0, 14), sticky="w")
    duration_select = ttk.Combobox(
        content,
        textvariable=duration,
        values=tuple(DURATION_DAYS),
        state="readonly",
        width=16,
    )
    duration_select.grid(row=1, column=1, pady=(0, 14), sticky="w")

    ttk.Label(content, text="License").grid(row=2, column=0, padx=(0, 12), pady=(0, 14), sticky="w")
    result_entry = ttk.Entry(content, textvariable=result, state="readonly")
    result_entry.grid(row=2, column=1, columnspan=2, pady=(0, 14), sticky="ew")

    action_row = ttk.Frame(content)
    action_row.grid(row=3, column=1, columnspan=2, pady=(0, 14), sticky="w")

    ttk.Label(content, textvariable=status, foreground="#555555", wraplength=600).grid(
        row=4,
        column=0,
        columnspan=3,
        sticky="w",
    )

    def invalidate(*_args: object) -> None:
        result.set("")
        status.set("输入已变更，请重新生成 License。")
        copy_button.configure(state="disabled")
        save_button.configure(state="disabled")

    def generate() -> None:
        try:
            days = DURATION_DAYS[duration.get()]
            if days is None:
                license_key = generate_license(machine_id.get())
                validity = "永久有效"
            else:
                license_key, expiry = generate_timed_license(machine_id.get(), days)
                validity = f"有效期至 {expiry:%Y-%m-%d}"
        except ValueError as error:
            messagebox.showerror("无法生成 License", str(error), parent=root)
            return

        result.set(license_key)
        status.set(f"生成成功：{validity}")
        copy_button.configure(state="normal")
        save_button.configure(state="normal")

    def copy_license() -> None:
        if not result.get():
            return
        root.clipboard_clear()
        root.clipboard_append(result.get())
        root.update_idletasks()
        status.set("License 已复制到剪贴板。")

    def save_license() -> None:
        if not result.get():
            return
        target = filedialog.asksaveasfilename(
            parent=root,
            title="保存 License",
            initialfile="license.txt",
            defaultextension=".txt",
            filetypes=(("文本文件", "*.txt"), ("所有文件", "*.*")),
        )
        if not target:
            return
        try:
            with open(target, "w", encoding="utf-8", newline="") as license_file:
                license_file.write(result.get())
        except OSError as error:
            messagebox.showerror("保存失败", str(error), parent=root)
            return
        status.set(f"License 已保存到：{target}")

    ttk.Button(action_row, text="生成 License", command=generate).grid(row=0, column=0)
    copy_button = ttk.Button(action_row, text="复制 License", command=copy_license, state="disabled")
    copy_button.grid(row=0, column=1, padx=(10, 0))
    save_button = ttk.Button(action_row, text="保存为 license.txt", command=save_license, state="disabled")
    save_button.grid(row=0, column=2, padx=(10, 0))
    machine_id.trace_add("write", invalidate)
    duration.trace_add("write", invalidate)
    machine_entry.focus_set()
    root.bind("<Return>", lambda _event: generate())
    return root


def main() -> None:
    create_window().mainloop()


if __name__ == "__main__":
    main()
