# Custom AI Agents & Models in Coucou

Coucou allows adding any AI agent, local model, or desktop script directly from **Settings → Custom AI Agents & Models**.

Out of the box, preset support is included for:
- **ZAI (Zhipu AI / GLM)** (`agent_zai` / `--agent zai`, color: `#1E88E5`)
- **Manus ("Manos")** (`agent_manus` / `--agent manus`, color: `#FF6B00`)
- **MiniMax** (`agent_minimax` / `--agent minimax`, color: `#7C3AED`)

---

## 1. How to Add a Custom Agent in Settings

1. Open Coucou Settings (click the tray icon or press `Ctrl+,`).
2. Scroll to the **Custom AI Agents & Models** section.
3. Enter:
   - **Name**: Display name for the agent (e.g. `DeepSeek`, `Kimi`, `Manus`, `MyAgent`).
   - **ID**: A short identifier (e.g. `deepseek`, `manus`) matching `^[a-z0-9-]{1,24}$`.
   - **Color**: Pick a color swatch or custom hex.
   - **Path (Optional)**: Path to your script or executable on Desktop (e.g. `C:\Users\...\Desktop\agent.exe`).
4. Click **Add Agent**.
5. Click **+ Add to Island** to pin it directly to the active island slots.

---

## 2. Connecting Your Agent / Script to Coucou

When your agent runs, send hook events to `coucou-hook.exe` using `--agent <id>`.

### Windows Command Line / PowerShell

```powershell
# 1. When a session starts:
echo '{"hook_event_name":"SessionStart"}' | coucou-hook.exe --agent manus

# 2. When the user sends a prompt (this opens and expands the island box live!):
echo '{"hook_event_name":"UserPromptSubmit","prompt":"Refactoring the authentication flow..."}' | coucou-hook.exe --agent manus

# 3. When the agent uses a tool (reading/writing files):
echo '{"hook_event_name":"PreToolUse","tool_name":"Edit","tool_input":{"file_path":"auth.ts"}}' | coucou-hook.exe --agent manus

# 4. When the agent completes changes (triggers finish sound + desktop notification):
echo '{"hook_event_name":"Stop","message":"Added OAuth2 login successfully."}' | coucou-hook.exe --agent manus
```

### Python Script Wrapper Example

```python
import subprocess
import json

def notify_coucou(agent_id, event_name, **kwargs):
    payload = {"hook_event_name": event_name, **kwargs}
    data = json.dumps(payload)
    try:
        subprocess.run(
            ["coucou-hook.exe", "--agent", agent_id],
            input=data.encode("utf-8"),
            capture_output=True,
            timeout=2
        )
    except Exception:
        pass

# When your agent receives a prompt:
notify_coucou("manus", "UserPromptSubmit", prompt="Writing tests for API...")

# When your agent edits a file:
notify_coucou("manus", "PreToolUse", tool_name="Edit", tool_input={"file_path": "test.py"})

# When the agent finishes:
notify_coucou("manus", "Stop", message="All tests passed and code updated!")
```

---

## 3. Real-Time Island Monitoring & Desktop Notifications

- **Live Island Display**: Whenever a `UserPromptSubmit` event occurs, the top island expands into an overview box showing the agent's name, color, and current task steps.
- **Completion Notifications**: When the agent sends `Stop`, Mochi plays the `finish.wav` sound and Windows dispatches a native desktop notification informing you that the additions are complete.
