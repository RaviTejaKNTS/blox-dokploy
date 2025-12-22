# Admin lean-up plan

Work done now:
- Added lightweight index views in Supabase (games, articles, lists) to avoid pulling heavy JSON: `game_pages_index_view`, `article_pages_index_view`, `game_lists_index_view`.
- Admin games list now uses `game_pages_index_view` with a 20 row cap and removes codes/markdown columns.
- Admin articles list now uses `article_pages_index_view` with a 20 row cap and only lean fields in the table UI.
- Main-site article/codes index queries now use the lean index views (`article_pages_index_view`, `game_pages_index_view`) for home/sidebars.

Next steps to finish egress reduction:
1) Admin games list
   - OPTIONAL: Add pagination (beyond first 20) and ensure search works without loading extra fields.
2) Admin articles list
   - OPTIONAL: Add pagination (beyond first 20) and keep list fetch lean.
3) Game editor
   - ✅ Removed codes tab/UI from admin game editor; no code refresh/add/delete in the panel.
   - ✅ Stopped fetching codes for game edit view (only game fields are loaded).
4) Article editor
   - Fetch full `content_md` only when opening a specific article; list view stays lean.
5) Lists
   - Ensure list index pages and admin list list use `game_lists_index_view`; load full `entries` only on list detail/edit.
6) API/search
   - Already trimmed; keep counts capped and fields minimal. Re-evaluate after admin changes.

After code changes:
- Run new migration to create the index views.
- Redeploy; monitor Supabase egress for a drop.
