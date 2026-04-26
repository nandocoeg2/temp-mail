# Decision Menu

## Decision Needed
Context:

## Specialist Consensus

## Options
| Option | Label | Recommended | Impact |
| --- | --- | --- | --- |
| 1 |  | yes |  |
| 2 |  | no |  |
| 3 |  | no |  |

## Popup / Choice UI Payload
Use this section with `request_user_input` or another popup/choice UI when the platform supports structured user-choice prompts.

```json
{
  "question": "",
  "choices": [
    {
      "label": "",
      "recommended": true,
      "description": ""
    },
    {
      "label": "",
      "recommended": false,
      "description": ""
    }
  ],
  "allow_free_text": false
}
```

## Fallback Chat Menu
Use numbered menu fallback only when popup/choice UI is unavailable.

```md
1. <Option> (Recommended)
   Impact: <short trade-off>

2. <Option>
   Impact: <short trade-off>
```

Do not add an explicit `Other` option. Accept free-text only when the choices cannot represent the decision.
