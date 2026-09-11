import unittest
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory
from tkinter import ttk
from unittest.mock import patch

from license_generator import calculate_checksum, create_window, generate_license, generate_timed_license


MACHINE_ID = "BFEBFBFF000B0671"


class LicenseGeneratorTest(unittest.TestCase):
    def test_generates_compatible_permanent_license(self) -> None:
        self.assertEqual(
            generate_license(MACHINE_ID),
            "f7d6-0d20-da16-cd13-553c-fa2c-6051-c861-222",
        )

    def test_generates_compatible_expiring_license(self) -> None:
        self.assertEqual(
            generate_license(MACHINE_ID, date(2030, 12, 31)),
            "562b-5d7d-4fa5-0241-25bb-fd79-688a-f55b-248-20301231",
        )

    def test_generates_supported_durations(self) -> None:
        today = date(2030, 1, 1)
        expected = {
            15: ("0fbf-4802-4438-e0ba-36b3-a330-6d32-265e-125-20300116", date(2030, 1, 16)),
            30: ("885d-1364-ae40-78d2-22f3-564b-fcb0-a7a3-187-20300131", date(2030, 1, 31)),
            90: ("479b-4e60-aa07-caef-e6e8-b3fb-9557-a9b4-396-20300401", date(2030, 4, 1)),
        }

        for days, values in expected.items():
            with self.subTest(days=days):
                generated, expiry = generate_timed_license(MACHINE_ID, days, today)
                self.assertEqual(generated, values[0])
                self.assertEqual(expiry, values[1])

    def test_calculates_compatible_checksum(self) -> None:
        self.assertEqual(calculate_checksum("f7d60d20da16cd13553cfa2c6051c861"), "222")

    def test_rejects_empty_machine_id(self) -> None:
        with self.assertRaisesRegex(ValueError, "请输入机器 ID"):
            generate_license("   ")

    def test_trims_machine_id_without_changing_case(self) -> None:
        self.assertEqual(generate_license(f"  {MACHINE_ID}\r\n"), generate_license(MACHINE_ID))
        self.assertNotEqual(generate_license(MACHINE_ID.lower()), generate_license(MACHINE_ID))

    def test_rejects_unsupported_duration(self) -> None:
        with self.assertRaisesRegex(ValueError, "不支持的授权期限"):
            generate_timed_license(MACHINE_ID, 7, date(2030, 1, 1))


class LicenseGeneratorWindowTest(unittest.TestCase):
    def setUp(self) -> None:
        self.root = create_window()
        self.root.withdraw()
        self.root.update_idletasks()

    def tearDown(self) -> None:
        self.root.destroy()

    def test_generates_copies_saves_and_invalidates_result(self) -> None:
        entries = self.widgets(ttk.Entry)
        machine_entry = next(entry for entry in entries if str(entry.cget("state")) == "normal")
        result_entry = next(entry for entry in entries if str(entry.cget("state")) == "readonly")
        duration = self.widgets(ttk.Combobox)[0]
        generate_button = self.button("生成 License")
        copy_button = self.button("复制 License")
        save_button = self.button("保存为 license.txt")

        machine_entry.insert(0, MACHINE_ID)
        generate_button.invoke()
        self.root.update()

        expected = "f7d6-0d20-da16-cd13-553c-fa2c-6051-c861-222"
        self.assertEqual(result_entry.get(), expected)
        self.assertEqual(str(copy_button.cget("state")), "normal")
        self.assertEqual(str(save_button.cget("state")), "normal")

        copy_button.invoke()
        self.root.update()
        self.assertEqual(self.root.clipboard_get(), expected)

        with TemporaryDirectory() as directory:
            target = Path(directory) / "license.txt"
            with patch("license_generator.filedialog.asksaveasfilename", return_value=str(target)):
                save_button.invoke()
            self.assertEqual(target.read_bytes(), expected.encode("utf-8"))

        duration.set("30 天")
        self.root.update()
        self.assertEqual(result_entry.get(), "")
        self.assertEqual(str(copy_button.cget("state")), "disabled")
        self.assertEqual(str(save_button.cget("state")), "disabled")

    def widgets(self, widget_type: type[ttk.Widget]) -> list[ttk.Widget]:
        pending = list(self.root.winfo_children())
        found: list[ttk.Widget] = []
        while pending:
            widget = pending.pop()
            pending.extend(widget.winfo_children())
            if isinstance(widget, widget_type):
                found.append(widget)
        return found

    def button(self, text: str) -> ttk.Button:
        return next(button for button in self.widgets(ttk.Button) if button.cget("text") == text)


if __name__ == "__main__":
    unittest.main()
