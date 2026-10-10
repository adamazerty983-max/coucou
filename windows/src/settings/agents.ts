// Settings → Agents: managed providers get a reviewed config installer; custom
// providers get the relay command to add to a hook system they support.

import { Bridge, type AgentHookStatus } from "../core/bridge";
import { type CustomAgent } from "../core/state";
import { HOST_OS } from "../core/pills";
import { clear, h } from "../views/dom";
import { renderDiff, statusDot } from "./parts";
import { t } from "../i18n/i18n";

/** In the current language (src/i18n); the settings window redraws on a change. */
const TEXT = {
  get title() { return t("Agents"); },
  get intro() {
    return t("Managed agents show a config preview before setup. For others, copy Coucou's command into a compatible hook setting.");
  },
  get none() { return t("Coucou could not list the agents."); },
  get approvals() { return t("Sessions, and Allow / Deny from the island"); },
  get displayOnly() { return t("Sessions — approvals stay in the agent"); },
  get install() { return t("Install…"); },
  get reinstall() { return t("Reinstall…"); },
  get uninstall() { return t("Uninstall…"); },
  get relayMissing() { return t("The relay isn't installed yet. Restart Coucou."); },
  get manualHook() { return t("Manual hook — add this command in the agent's own hook settings."); },
  get copyHook() { return t("Copy hook command"); },
  get hookCopied() { return t("Hook command copied."); },
  get copyFailed() { return t("Could not copy the hook command."); },
  previewInstall: (name: string) => t("This is exactly what changes for {name}. Nothing else is touched.", { name }),
  get previewRemove() { return t("This removes Coucou's entries only. Everything else stays."); },
  backup: (to: string) => (to ? t("Backup → {path}", { path: to }) : t("No existing file — nothing to back up.")),
  get confirmInstall() { return t("Back up and write"); },
  get confirmRemove() { return t("Back up and remove"); },
  get cancel() { return t("Cancel"); },
  get back() { return t("Back"); },
  done: (backups: string, note: string) => {
    const saved = backups
      ? t("Done. Previous version saved as {paths}.", { paths: backups.split("\n").join(", ") })
      : t("Done.");
    return `${saved} ${note}`;
  },
  failed: (err: unknown) => t("Could not write: {error}", { error: errorText(err) }),
};

function errorText(err: unknown): string {
  return String(err).replace(/^Error:\s*/, "");
}

export function agentsSection(
  list: AgentHookStatus[] | null,
  customAgents: CustomAgent[] = [],
  hookPath = "",
): HTMLElement {
  const blocks = h("div", { style: "display:flex;flex-direction:column;gap:14px" });
  if (!list || list.length === 0) {
    blocks.append(h("div", { class: "hint", text: TEXT.none }));
  }
  for (const status of list ?? []) blocks.append(agentBlock(status));
  const managed = new Set((list ?? []).map((status) => status.id));
  for (const agent of customAgents) {
    if (!managed.has(agent.id)) blocks.append(manualAgentBlock(agent, hookPath));
  }
  return h(
    "section",
    {},
    h("h2", {}, h("span", { text: TEXT.title })),
    h("div", { class: "hint", text: TEXT.intro }),
    blocks,
  );
}

/** Custom providers have no managed config format; offer the relay command and
 * let the user add it to a provider hook configuration that supports commands. */
function manualAgentBlock(agent: CustomAgent, hookPath: string): HTMLElement {
  const command = hookPath ? HOST_OS === "windows"
    ? `& '${hookPath.replace(/'/g, "''")}' --agent ${agent.id}`
    : `'${hookPath.replace(/'/g, "'\\''")}' --agent ${agent.id}` : "";
  const copy = h("button", {
    text: TEXT.copyHook,
    disabled: !hookPath,
    title: hookPath ? "" : TEXT.relayMissing,
    onclick: async () => {
      try {
        await navigator.clipboard.writeText(command);
        copy.textContent = TEXT.hookCopied;
      } catch {
        copy.textContent = TEXT.copyFailed;
      }
    },
  });
  return h(
    "div",
    { style: "display:flex;flex-direction:column;gap:8px" },
    h("div", { class: "row" },
      h("div", { style: "display:flex;align-items:center;gap:8px;min-width:132px" },
        h("span", { style: "font-size:12.5px", text: agent.name }),
      ),
      h("span", { class: "hint", text: TEXT.manualHook }),
      h("span", { class: "spacer" }),
      copy,
    ),
    h("span", { class: "path", text: command || TEXT.relayMissing }),
  );
}

function agentBlock(initial: AgentHookStatus): HTMLElement {
  let status = initial;
  const head = h("div", { class: "row" });
  const body = h("div", { style: "display:flex;flex-direction:column;gap:10px" });
  const block = h("div", { style: "display:flex;flex-direction:column;gap:8px" }, head, body);

  async function refresh() {
    const fresh = (await Bridge.agentHooksList())?.find((a) => a.id === status.id);
    if (fresh) status = fresh;
    draw();
  }

  function draw() {
    clear(head);
    clear(body);
    const install = h("button", {
      class: "primary",
      text: status.installed ? TEXT.reinstall : TEXT.install,
      onclick: () => void showPreview(true),
    });
    // A hook pointing at a relay that isn't there would break the agent's hooks.
    if (!status.hookReady) {
      install.disabled = true;
      install.title = TEXT.relayMissing;
    }
    head.append(
      h("div", { style: "display:flex;align-items:center;gap:8px;min-width:132px" },
        statusDot(status.installed),
        h("span", { style: "font-size:12.5px", text: status.name }),
      ),
      h("span", { class: "hint", text: status.approvals ? TEXT.approvals : TEXT.displayOnly }),
      h("span", { class: "spacer" }),
      install,
    );
    if (status.installed) {
      head.append(h("button", {
        class: "danger",
        text: TEXT.uninstall,
        onclick: () => void showPreview(false),
      }));
    }
    body.append(h("span", { class: "path", text: status.path }));
  }

  async function showPreview(install: boolean) {
    let plan;
    try {
      plan = await Bridge.agentHooksPreview(status.id, install);
    } catch (err) {
      // An unreadable or unexpected config stops here rather than being
      // treated as empty and written over.
      clear(body);
      body.append(
        h("div", { class: "notice err", text: errorText(err) }),
        h("div", { class: "row" }, h("button", { text: TEXT.back, onclick: draw })),
      );
      return;
    }
    clear(body);
    body.append(
      h("div", { class: "hint", text: install ? TEXT.previewInstall(status.name) : TEXT.previewRemove }),
      renderDiff(plan.diff),
      h("div", { class: "row" }, h("span", { class: "path", text: TEXT.backup(plan.backup) })),
    );
    const confirm = h("button", {
      class: install ? "primary" : "danger",
      text: install ? TEXT.confirmInstall : TEXT.confirmRemove,
    });
    confirm.addEventListener("click", async () => {
      confirm.disabled = true;
      try {
        const backups = await Bridge.agentHooksApply(status.id, install, plan.fingerprint);
        clear(body);
        body.append(h("div", { class: "notice ok", text: TEXT.done(backups, install ? status.note : "") }));
        window.setTimeout(() => void refresh(), 2600);
      } catch (err) {
        confirm.disabled = false;
        body.append(h("div", { class: "notice err", text: TEXT.failed(err) }));
      }
    });
    body.append(h("div", { class: "row" }, confirm, h("button", { text: TEXT.cancel, onclick: draw })));
  }

  draw();
  return block;
}
