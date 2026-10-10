// Settings → Custom Agents: add, view, and manage custom AI agents (ZAI, Manus, MiniMax, or any Desktop model).

import { clear, h } from "../views/dom";
import { t } from "../i18n/i18n";
import { type CustomAgent, type Settings } from "../core/state";
import { registerCustomAgent, validateAgent } from "../island/agents";
import { setCustomAgents } from "../core/pills";
import { OUTFIT_LABELS, OUTFIT_SELECTIONS, type OutfitSelection } from "../mochi/wardrobe";

const PRESET_COLORS = [
  "#1E88E5", // Blue (ZAI)
  "#FF6B00", // Orange (Manus)
  "#7C3AED", // Purple (MiniMax)
  "#10B981", // Emerald
  "#EC4899", // Pink
  "#F59E0B", // Amber
  "#06B6D4", // Cyan
  "#8B5CF6", // Violet
];

const BUILTIN_AGENTS: CustomAgent[] = [
  { id: "zai", name: "ZAI", color: "#1E88E5" },
  { id: "manus", name: "Manus", color: "#FF6B00" },
  { id: "minimax", name: "MiniMax", color: "#7C3AED" },
  { id: "zcode", name: "Z Code", color: "#13B8A6" },
];

/** Add the built-in integrations to settings created by older app versions. */
export function ensureBuiltinAgents(settings: Settings): boolean {
  const existing = new Set((settings.customAgents ?? []).map((agent) => agent.id));
  const missing = BUILTIN_AGENTS.filter((agent) => !existing.has(agent.id));
  if (!missing.length) return false;
  settings.customAgents = [...(settings.customAgents ?? []), ...missing];
  return true;
}

export function customAgentsSection(
  settings: Settings,
  save: () => Promise<void>,
  onChanged: () => void,
): HTMLElement {
  ensureBuiltinAgents(settings);
  settings.pillOutfits ??= {};

  const listContainer = h("div", { style: "display:flex;flex-direction:column;gap:10px" });
  const noticeContainer = h("div", {});

  // Form inputs
  const nameInput = h("input", {
    type: "text",
    placeholder: "e.g. Manus, DeepSeek, MyAgent",
    style: "flex:1;min-width:140px;padding:6px 10px;border-radius:6px;border:1px solid var(--hairline);background:rgba(255,255,255,0.04);color:var(--ink);font-size:12.5px",
  }) as HTMLInputElement;

  const idInput = h("input", {
    type: "text",
    placeholder: "e.g. manus, my-agent",
    style: "flex:1;min-width:120px;padding:6px 10px;border-radius:6px;border:1px solid var(--hairline);background:rgba(255,255,255,0.04);color:var(--ink);font-size:12.5px",
  }) as HTMLInputElement;

  let selectedColor = PRESET_COLORS[0];
  const colorPickerContainer = h("div", { style: "display:flex;align-items:center;gap:6px;flex-wrap:wrap" });

  function renderColorSwatches() {
    clear(colorPickerContainer);
    for (const c of PRESET_COLORS) {
      const isSelected = c.toUpperCase() === selectedColor.toUpperCase();
      const swatch = h("button", {
        type: "button",
        style: `width:18px;height:18px;border-radius:50%;background:${c};border:${isSelected ? "2px solid #fff" : "1px solid rgba(255,255,255,0.2)"};cursor:pointer;padding:0`,
        title: c,
        onclick: () => {
          selectedColor = c;
          renderColorSwatches();
        },
      });
      colorPickerContainer.append(swatch);
    }
  }
  renderColorSwatches();

  // Auto-slugify ID when name is typed if ID wasn't manually edited
  let idManuallyEdited = false;
  idInput.addEventListener("input", () => {
    idManuallyEdited = true;
  });
  nameInput.addEventListener("input", () => {
    if (!idManuallyEdited) {
      idInput.value = nameInput.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 24);
    }
  });

  const cmdInput = h("input", {
    type: "text",
    placeholder: "Executable or script path (optional, e.g. C:\\...\\agent.exe)",
    style: "flex:1;min-width:220px;padding:6px 10px;border-radius:6px;border:1px solid var(--hairline);background:rgba(255,255,255,0.04);color:var(--ink);font-size:12.5px",
  }) as HTMLInputElement;

  const addButton = h("button", {
    class: "primary",
    text: "Add Agent",
  });

  addButton.addEventListener("click", async () => {
    const rawName = nameInput.value.trim();
    let rawId = idInput.value.trim().toLowerCase();
    if (!rawId && rawName) {
      rawId = rawName.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 24);
    }

    if (!rawName) {
      showNotice("Please enter an agent name.", true);
      return;
    }

    const validId = validateAgent(rawId);
    if (!validId) {
      showNotice("Agent ID must be 1-24 lowercase letters, numbers, or hyphens (and not 'claude').", true);
      return;
    }

    if (settings.customAgents?.some((a) => a.id === validId)) {
      showNotice("An agent with this ID already exists.", true);
      return;
    }

    const newAgent: CustomAgent = {
      id: validId,
      name: rawName,
      color: selectedColor.toUpperCase(),
      command: cmdInput.value.trim() || undefined,
    };

    settings.customAgents = [...(settings.customAgents ?? []), newAgent];
    registerCustomAgent(newAgent.id, newAgent.name, newAgent.color);
    setCustomAgents(settings.customAgents);
    await save();

    nameInput.value = "";
    idInput.value = "";
    cmdInput.value = "";
    idManuallyEdited = false;
    showNotice(`Agent '${rawName}' added successfully!`, false);
    drawList();
    onChanged();
  });

  function showNotice(msg: string, isErr: boolean) {
    clear(noticeContainer);
    noticeContainer.append(h("div", { class: isErr ? "notice err" : "notice ok", text: msg }));
    window.setTimeout(() => clear(noticeContainer), 4000);
  }

  function drawList() {
    clear(listContainer);
    const agents = settings.customAgents ?? [];
    if (agents.length === 0) {
      listContainer.append(h("div", { class: "hint", text: "No custom agents configured yet." }));
      return;
    }

    for (const agent of agents) {
      const isDeclared = settings.activeIntegrations.includes(`agent_${agent.id}`);
      const outfit = settings.pillOutfits[`agent_${agent.id}`] ?? "none";
      const outfitSelect = h("select", {
        "aria-label": `${agent.name} Mochi appearance`,
        style: "min-width:130px;padding:4px 8px;border-radius:6px;border:1px solid var(--hairline);background:var(--panel);color:var(--ink);font-size:11px",
        onchange: async (event: Event) => {
          const value = (event.currentTarget as HTMLSelectElement).value as OutfitSelection;
          settings.pillOutfits[`agent_${agent.id}`] = value;
          await save();
        },
      }) as HTMLSelectElement;
      for (const selection of OUTFIT_SELECTIONS.filter((value) => value !== "auto")) {
        outfitSelect.append(h("option", { value: selection, text: OUTFIT_LABELS[selection] }));
      }
      outfitSelect.value = OUTFIT_SELECTIONS.includes(outfit as OutfitSelection) && outfit !== "auto" ? outfit : "none";
      const row = h(
        "div",
        {
          style:
            "display:flex;align-items:center;gap:12px;padding:8px 12px;background:rgba(255,255,255,0.02);border:1px solid var(--hairline);border-radius:8px;flex-wrap:wrap",
        },
        // Color dot & Name
        h(
          "div",
          { style: "display:flex;align-items:center;gap:8px;min-width:140px" },
          h("div", {
            style: `width:10px;height:10px;border-radius:50%;background:${agent.color}`,
          }),
          h("span", { style: "font-weight:600;font-size:13px", text: agent.name }),
          h("span", { style: "color:var(--dim-2);font-size:11px", text: `(${agent.id})` }),
        outfitSelect,
        ),
        // Hook command snippet
        h(
          "div",
          { style: "display:flex;align-items:center;gap:6px;flex:1;min-width:200px" },
          h("span", {
            class: "path",
            style: "font-family:var(--mono);font-size:11px;background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px",
            text: `coucou-hook.exe --agent ${agent.id}`,
          }),
          h("button", {
            style: "font-size:11px;padding:2px 8px",
            text: "Copy hook",
            onclick: () => {
              void navigator.clipboard.writeText(`coucou-hook.exe --agent ${agent.id}`);
              showNotice("Hook command copied to clipboard!", false);
            },
          }),
        ),
        // Active pills toggle
        h("button", {
          style: "font-size:11px;padding:3px 10px",
          class: isDeclared ? "primary" : "",
          text: isDeclared ? "In Island (Active)" : "+ Add to Island",
          onclick: async () => {
            const pillId = `agent_${agent.id}`;
            if (settings.activeIntegrations.includes(pillId)) {
              settings.activeIntegrations = settings.activeIntegrations.filter((x) => x !== pillId);
            } else {
              if (settings.activeIntegrations.length >= 4) {
                showNotice("Maximum 4 active pills slots used. Remove another pill first.", true);
                return;
              }
              settings.activeIntegrations.push(pillId);
            }
            await save();
            drawList();
            onChanged();
          },
        }),
        // Delete button
        ...(BUILTIN_AGENTS.some((builtin) => builtin.id === agent.id) ? [] : [h("button", {
          class: "danger",
          style: "font-size:11px;padding:3px 8px",
          text: "Delete",
          onclick: async () => {
            const pillId = `agent_${agent.id}`;
            settings.customAgents = settings.customAgents?.filter((a) => a.id !== agent.id);
            settings.activeIntegrations = settings.activeIntegrations.filter((x) => x !== pillId);
            setCustomAgents(settings.customAgents ?? []);
            await save();
            drawList();
            onChanged();
          },
        })]),
      );
      listContainer.append(row);
    }
  }

  drawList();

  return h(
    "section",
    {},
    h("h2", {}, h("span", { text: "Custom AI Agents & Models" })),
    h("div", {
      class: "hint",
      text: "Add an agent pill, choose its Mochi color and look, and connect lifecycle events for live task progress. Z Code has managed hook setup; other agents need a compatible local hook or event bridge.",
    }),
    noticeContainer,
    listContainer,
    h(
      "div",
      {
        style:
          "display:flex;flex-direction:column;gap:10px;margin-top:10px;padding:12px;background:rgba(255,255,255,0.02);border:1px dashed var(--hairline);border-radius:10px",
      },
      h("span", { style: "font-weight:600;font-size:12.5px", text: "Add a new AI agent:" }),
      h(
        "div",
        { class: "row", style: "gap:8px" },
        h("label", { style: "min-width:60px", text: "Name" }),
        nameInput,
        h("label", { style: "min-width:40px", text: "ID" }),
        idInput,
      ),
      h(
        "div",
        { class: "row", style: "gap:8px" },
        h("label", { style: "min-width:60px", text: t("Color") }),
        colorPickerContainer,
      ),
      h(
        "div",
        { class: "row", style: "gap:8px" },
        h("label", { style: "min-width:60px", text: "Path" }),
        cmdInput,
        addButton,
      ),
    ),
  );
}
