# Phase 6E Direct Original UI AI Inline Fix

## 1. Why Stop Stitch

Phase 6E stops the Stitch route because previous outputs repeatedly moved TitleLab away from the real product surface: new app shells, bottom tabs, mobile product layouts, image-stream patterns, and Material-like structures. Those outputs did not preserve the existing TitleLab Web/PWA UI that users already recognize.

This phase therefore patches the real frontend files directly and keeps the current blue/white TitleLab UI as the locked source of truth.

## 2. Real UI Source

The real Phase 6E UI surface is the Web/PWA static frontend:

- `index.html`
- `title.html`
- `content.html`
- `assets/app-title.js`
- `assets/app-content.js`
- `assets/styles.css`

The current first-screen identity remains the existing `THE` logo, topbar, title/copy tabs, user badge, logout button, category management area, search/filter toolbar, account category filter, and management/settings actions.

## 3. Original UI Lock

Phase 6E keeps the original UI shape:

- No Stitch code.
- No new bottom tab.
- No floating plus button.
- No separate AI app page.
- No image feed.
- No table rewrite of the title body.
- No removal of copy / AI / edit / delete actions.
- No removal of category, search, account category, local default, theme settings, or management entry.

The allowed change is only an inline AI layer inside the current list rows/cards.

## 4. Title AI Inline Panel

The title tab now uses `activeAiTitleId` to open one inline panel at a time. Clicking a title row/card `✨AI` button inserts an `AI 标题灵感` panel under the current title item.

The panel is local-only and includes:

- `本地示例` badge.
- Current title reference.
- Mode chips: `相似标题` / `更吸引人` / `更小红书` / `更自然`.
- Three photography/travel-shoot title examples.
- `复制`, `加入标题库`, `换一批`, and `关闭` controls.

No network request or external provider is used by this panel.

## 5. Copy Expand And AI Panel

The copy tab now uses `expandedCopyId` for the existing collapse/expand behavior and `activeCopyAiId` for the inline copy assistant.

Collapsed copy rows/cards keep:

- Index/star area.
- First-line summary.
- `▼` or `▲` affordance.
- `复制` / `✨AI` / `修改` / `删除`.

Expanded content stays inside the current row/card and uses a light embedded text box. The mock copywriting sample is Hong Kong Disneyland photography-specific and includes full lines plus hashtags.

The `AI 文案助手` panel is also local-only and includes:

- `本地示例` badge.
- Mode chips: `提取标题` / `改写文案` / `生成话题` / `精简文案`.
- Three title extraction examples with copy/add actions.
- Local rewrite, topic, and concise-copy examples.
- `换一批` and `关闭`.

## 6. Category Dropdown Protection

Phase 6E does not insert AI controls into the category list. The category list remains owned by the existing category renderer and still keeps count, up/down, and edit controls where the current UI enables sorting.

The AI controls live only in title/copy list rows and cards.

## 7. Prohibited Scope

This phase does not:

- Call OpenAI or any external AI service.
- Read or write real API keys.
- Request a backend AI endpoint.
- Connect to a database.
- Execute migrations.
- Add dependencies.
- Modify `backend/alembic/**`, `backend/app/db/**`, or `backend/app/models/**`.
- Deploy, upload preview, or submit review.
- Touch `miniprogram/project.private.config.json`.

## 8. Checks

Primary checks:

```bash
node --check assets/app-title.js
node --check assets/app-content.js
python3 scripts/titlelab_phase6e_original_ui_ai_inline_check.py
python3 scripts/titlelab_phase6d_miniprogram_devtools_acceptance_check.py
python3 -m compileall backend/app backend/tests
cd backend && uv run --no-project --with fastapi --with uvicorn --with sqlalchemy --with alembic --with pydantic-settings --with pytest --with httpx python -m pytest
git diff --check
```

## 9. Risks

- The existing Web/PWA still contains older cloud sync and Supabase-driven flows outside this Phase 6E local AI layer.
- Manual visual confirmation should still be done in a browser or PWA preview before any release-facing step.
- The `加入标题库` action is intentionally local front-end state only for this phase; persistence can be designed in a later gated phase.

## 10. Next Step

Run a manual Web/PWA visual acceptance pass for the real title and copy pages, focusing on title AI inline expand/collapse, copy expand/collapse, copy AI inline panel, and category dropdown behavior. Do not deploy or connect a real AI provider until a later release-gated phase explicitly allows it.
