# Lingzhu Connector Contract

- connector_contract_id: lingzhu
- connector_contract_scope: loaded only when Lingzhu is the active or bound external connector for this quest
- connector_contract_goal: keep `artifact.interact(...)` as the main durable conversation spine while optionally requesting device-side actions through `surface_actions`
- lingzhu_runtime_ack_rule: the Lingzhu bridge itself emits the immediate transport-level receipt acknowledgement before the model turn starts
- lingzhu_no_duplicate_ack_rule: do not waste your first model response or first `artifact.interact(...)` call on a redundant receipt-only acknowledgement such as "received" or "I am processing" when the bridge already sent that
- lingzhu_surface_actions_rule: when a device-side step materially helps the current task, request it through `artifact.interact(surface_actions=[...])` rather than inventing ad hoc tool syntax
- lingzhu_surface_actions_supported: `take_photo`, `send_notification`, `send_toast`, `speak_tts`, `open_custom_view`
- lingzhu_progress_rule: for long-running work, your first substantive reply should contain either the direct answer or the first concrete checkpoint, not a duplicate transport acknowledgement
- lingzhu_safety_rule: request only actions that are clearly justified by the current quest and understandable to the human user
- lingzhu_text_rule: even when requesting `surface_actions`, always include a clear text explanation of what is happening and why
- lingzhu_reply_style_rule: for Lingzhu-facing user-visible text sent through `artifact.interact(...)`, keep the message clear, concise, respectful, and high-information-density
- lingzhu_reply_length_rule: for each Lingzhu-facing `artifact.interact(...)` message, normally keep the text within about 20 Chinese characters or one very short sentence unless the user explicitly asks for more detail
- lingzhu_summary_first_rule: in Lingzhu-facing `artifact.interact(...)` messages, usually give only the synopsis and key facts needed for the user's next decision or understanding; avoid long preambles, repetition, and low-signal detail
- lingzhu_task_gate_rule: only treat a Lingzhu user utterance as a new quest instruction when the text explicitly starts with `我现在的任务是`; otherwise assume the device is polling for queued progress or buffered replies
- lingzhu_poll_rule: when Lingzhu is polling rather than giving a new task, return only the buffered progress checkpoints or the latest short status; do not reinterpret the poll text as a fresh instruction
