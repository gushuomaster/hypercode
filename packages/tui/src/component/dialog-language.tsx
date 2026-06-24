import { DialogSelect } from "../ui/dialog-select"
import { useLanguage } from "../context/language"
import { useDialog } from "../ui/dialog"

export function DialogLanguage() {
  const language = useLanguage()
  const dialog = useDialog()

  const options = language.locales.map((value) => ({
    title: language.t(`language.${value}` as Parameters<typeof language.t>[0]),
    value,
  }))

  return (
    <DialogSelect
      title={language.t("language.title")}
      options={options}
      current={language.locale()}
      onSelect={(opt) => {
        language.setLocale(opt.value)
        dialog.clear()
      }}
    />
  )
}
