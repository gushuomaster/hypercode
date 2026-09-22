import { DialogSelect } from "../../ui/dialog-select"
import { useRoute } from "../../context/route"
import { translate as t } from "../../context/language"

export function DialogSubagent(props: { sessionID: string }) {
  const route = useRoute()

  return (
    <DialogSelect
      title={t("session.subagentActions.title")}
      options={[
        {
          title: t("session.subagentActions.open"),
          value: "subagent.view",
          description: t("session.subagentActions.openDescription"),
          onSelect: (dialog) => {
            route.navigate({
              type: "session",
              sessionID: props.sessionID,
            })
            dialog.clear()
          },
        },
      ]}
    />
  )
}
