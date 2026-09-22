import { createRoot } from "react-dom/client"
import { App } from "./app/App"
import { setLocale } from "../../i18n"
import "./theme.css"
import "./base.css"
import "./layout.css"
import "./context.css"
import "./timeline.css"
import "./tool.css"
import "./dock.css"
import "./diff.css"
import "./markdown.css"
import "./status.css"

const root = document.getElementById("root")

setLocale(document.documentElement.lang)

if (!root) {
  throw new Error("Missing webview root")
}

createRoot(root).render(<App />)
