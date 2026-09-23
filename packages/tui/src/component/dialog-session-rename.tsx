import { DialogPrompt } from "../ui/dialog-prompt"
import { useDialog } from "../ui/dialog"
import { useSync } from "../context/sync"
import { createMemo } from "solid-js"
import { useSDK } from "../context/sdk"
import { translate as t } from "../context/language"
import { deriveProductSessionMutationStatus } from "@opencode-ai/product"
import { runTuiSessionMutation } from "../product/session-mutation-adapter"
import { useToast } from "../ui/toast"
import { formatTuiProductError } from "../product/text-adapter"

interface DialogSessionRenameProps {
  session: string
}

export function DialogSessionRename(props: DialogSessionRenameProps) {
  const dialog = useDialog()
  const sync = useSync()
  const sdk = useSDK()
  const toast = useToast()
  const session = createMemo(() => sync.session.get(props.session))
  const busy = createMemo(() => deriveProductSessionMutationStatus(
    sync.data.session_mutation,
    props.session,
    "rename",
  ).state === "pending")

  return (
    <DialogPrompt
      title={t("dialog.session.rename")}
      value={session()?.title}
      busy={busy()}
      onConfirm={(value) => {
        const target = sync.session.mutation.target({ type: "session.rename", sessionID: props.session, title: value })
        if (target.kind !== "session.update") return
        void runTuiSessionMutation(target, {
          update: (input) => sdk.client.session.update(input),
          share: async () => "",
          unshare: async () => {},
        }, sync.session.mutation.set).then((result) => {
          if (result.ok) {
            dialog.clear()
            return
          }
          const status = result.state.mutations[props.session]?.rename
          if (status?.state !== "error") return
          toast.show({ message: formatTuiProductError(status.error), variant: "error" })
        })
      }}
      onCancel={() => dialog.clear()}
    />
  )
}
