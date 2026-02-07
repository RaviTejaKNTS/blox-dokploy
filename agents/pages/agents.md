# UI pages inventory (App Router)

Revalidate values are from each page's export const revalidate. Data caches also exist in src/lib/* via unstable_cache tags.

## Global shell
| Route | File | Data/Notes | Revalidate |
| --- | --- | --- | --- |
| (root layout) | src/app/layout.tsx | Global metadata, consent gates, analytics, theme script, JSON-LD site/org. | force-static |
| (site layout) | src/app/(site)/layout.tsx | Header/footer shell for marketing pages. | n/a |
| (globals) | src/app/globals.css | Global styles + Tailwind base. | n/a |
| 404 | src/app/(site)/not-found.tsx | Friendly 404 with links to core hubs. | n/a |

## Home
| Route | File | Data/Notes | Revalidate |
| --- | --- | --- | --- |
| / | src/app/(site)/page.tsx | Games, articles, checklists, lists, tools, events cards, music stats. JSON-LD CollectionPage. | 21600 |

## Codes
| Route | File | Data/Notes | Revalidate |
| --- | --- | --- | --- |
| /codes | src/app/(site)/codes/page.tsx | Index via listGamesWithActiveCountsPage. JSON-LD CollectionPage. | 86400 |
| /codes/page/[page] | src/app/(site)/codes/page/[page]/page.tsx | Paginated codes index. | 86400 |
| /codes/[slug] | src/app/(site)/codes/[slug]/page.tsx | Code page from code_pages_view; active/expired codes, FAQ extraction, social share, JSON-LD. | 86400 |
| /[slug] | src/app/(site)/[slug]/page.tsx | Legacy slug redirect using src/data/slug_oldslugs.json. | n/a |

## Articles
| Route | File | Data/Notes | Revalidate |
| --- | --- | --- | --- |
| /articles | src/app/(site)/articles/page.tsx | Article index via article_pages_index_view. JSON-LD CollectionPage. | 604800 |
| /articles/page/[page] | src/app/(site)/articles/page/[page]/page.tsx | Paginated article index. | 604800 |
| /articles/[slug] | src/app/(site)/articles/[slug]/page.tsx | Article detail from article_pages_view; markdown, related items, how-to schema. | 604800 |

## Lists
| Route | File | Data/Notes | Revalidate |
| --- | --- | --- | --- |
| /lists | src/app/(site)/lists/page.tsx | Lists index via game_lists_index_view. JSON-LD CollectionPage. | 86400 |
| /lists/page/[page] | src/app/(site)/lists/page/[page]/page.tsx | Paginated lists index. | 86400 |
| /lists/[slug] | src/app/(site)/lists/[slug]/page.tsx | List detail from game_lists + game_list_entries; ranking UI + JSON-LD. | 86400 |
| /lists/[slug]/page/[page] | src/app/(site)/lists/[slug]/page/[page]/page.tsx | Paginated list detail; noindex for page > 1. | 86400 |

## Checklists
| Route | File | Data/Notes | Revalidate |
| --- | --- | --- | --- |
| /checklists | src/app/(site)/checklists/page.tsx | Checklists index via checklist_pages_view. JSON-LD CollectionPage. | 21600 |
| /checklists/page/[page] | src/app/(site)/checklists/page/[page]/page.tsx | Paginated checklists index. | 21600 |
| /checklists/[slug] | src/app/(site)/checklists/[slug]/page.tsx | Checklist detail + board UI; checklist_pages_view + checklist_items; JSON-LD ItemList. | 3600 |

## Events
| Route | File | Data/Notes | Revalidate |
| --- | --- | --- | --- |
| /events | src/app/(site)/events/page.tsx | Events index; cards from events_pages + roblox_virtual_events. | 3600 |
| /events/[slug] | src/app/(site)/events/[slug]/page.tsx | Event detail + schedule/countdown; events_pages + roblox_virtual_events. | 3600 |

## Catalog
| Route | File | Data/Notes | Revalidate |
| --- | --- | --- | --- |
| /catalog | src/app/(site)/catalog/page.tsx | Catalog hub; music stats + admin commands summary. | 3600 |
| /catalog/roblox-music-ids | src/app/(site)/catalog/roblox-music-ids/page.tsx | Music IDs hub from roblox_music_ids_ranked_view; client browser uses /api/roblox-music-ids. | 2592000 |
| /catalog/roblox-music-ids/page/[page] | src/app/(site)/catalog/roblox-music-ids/page/[page]/page.tsx | Paginated music IDs. | 2592000 |
| /catalog/roblox-music-ids/trending | src/app/(site)/catalog/roblox-music-ids/trending/page.tsx | Trending music IDs by rank. | 2592000 |
| /catalog/roblox-music-ids/trending/page/[page] | src/app/(site)/catalog/roblox-music-ids/trending/page/[page]/page.tsx | Paginated trending music IDs. | 2592000 |
| /catalog/roblox-music-ids/genres | src/app/(site)/catalog/roblox-music-ids/genres/page.tsx | Genre list from roblox_music_genres_view. | 2592000 |
| /catalog/roblox-music-ids/genres/page/[page] | src/app/(site)/catalog/roblox-music-ids/genres/page/[page]/page.tsx | Paginated genre list. | 2592000 |
| /catalog/roblox-music-ids/genres/[genre] | src/app/(site)/catalog/roblox-music-ids/genres/[genre]/page.tsx | Genre detail from roblox_music_ids_ranked_view. | 2592000 |
| /catalog/roblox-music-ids/genres/[genre]/page/[page] | src/app/(site)/catalog/roblox-music-ids/genres/[genre]/page/[page]/page.tsx | Paginated genre detail. | 2592000 |
| /catalog/roblox-music-ids/artists | src/app/(site)/catalog/roblox-music-ids/artists/page.tsx | Artist list from roblox_music_artists_view. | 2592000 |
| /catalog/roblox-music-ids/artists/page/[page] | src/app/(site)/catalog/roblox-music-ids/artists/page/[page]/page.tsx | Paginated artist list. | 2592000 |
| /catalog/roblox-music-ids/artists/[artist] | src/app/(site)/catalog/roblox-music-ids/artists/[artist]/page.tsx | Artist detail from roblox_music_ids_ranked_view. | 2592000 |
| /catalog/roblox-music-ids/artists/[artist]/page/[page] | src/app/(site)/catalog/roblox-music-ids/artists/[artist]/page/[page]/page.tsx | Paginated artist detail. | 2592000 |
| /catalog/admin-commands | src/app/(site)/catalog/admin-commands/page.tsx | Admin commands hub; catalog_pages_view + data/Admin commands/*.md. | 86400 |
| /catalog/admin-commands/[system] | src/app/(site)/catalog/admin-commands/[system]/page.tsx | Command list detail from markdown dataset. | 86400 |
| /catalog/[...slug] | src/app/(site)/catalog/[...slug]/page.tsx | Generic catalog fallback from catalog_pages_view. | 86400 |

## Tools
| Route | File | Data/Notes | Revalidate |
| --- | --- | --- | --- |
| /tools | src/app/(site)/tools/page.tsx | Tools index via tools_view. JSON-LD CollectionPage. | 21600 |
| /tools/page/[page] | src/app/(site)/tools/page/[page]/page.tsx | Paginated tools index. | 21600 |
| /tools/roblox-id-extractor | src/app/(site)/tools/roblox-id-extractor/page.tsx | Tool copy from tools_view; client calls /api/roblox-id-extractor. | 3600 |
| /tools/robux-to-usd-calculator | src/app/(site)/tools/robux-to-usd-calculator/page.tsx | Uses robux-bundles.ts + robux-plans.ts. | 3600 |
| /tools/roblox-devex-calculator | src/app/(site)/tools/roblox-devex-calculator/page.tsx | Uses tools_view + devex constants; calculator client. | 3600 |
| /tools/the-forge-crafting-calculator | src/app/(site)/tools/the-forge-crafting-calculator/page.tsx | Uses data/The Forge/ores.json via src/lib/forge/ores.ts. | 3600 |
| /tools/grow-a-garden-crop-value-calculator | src/app/(site)/tools/grow-a-garden-crop-value-calculator/page.tsx | Uses data/Grow a Garden/crops.json via src/lib/grow-a-garden/crops.ts. | 3600 |
| /tools/[...slug] | src/app/(site)/tools/[...slug]/page.tsx | Generic tool fallback from tools_view. | 3600 |

## Authors
| Route | File | Data/Notes | Revalidate |
| --- | --- | --- | --- |
| /authors | src/app/(site)/authors/page.tsx | Authors index from authors table. | 2592000 |
| /authors/[slug] | src/app/(site)/authors/[slug]/page.tsx | Author detail with authored games + articles. | 2592000 |

## Static + policy pages
| Route | File | Data/Notes | Revalidate |
| --- | --- | --- | --- |
| /about | src/app/(site)/about/page.tsx | Static content + metadata. | n/a |
| /contact | src/app/(site)/contact/page.tsx | Static contact content. | n/a |
| /privacy-policy | src/app/(site)/privacy-policy/page.tsx | Static policy copy. | n/a |
| /editorial-guidelines | src/app/(site)/editorial-guidelines/page.tsx | Static editorial policy. | n/a |
| /disclaimer | src/app/(site)/disclaimer/page.tsx | Static disclaimer copy + JSON-LD. | n/a |
| /how-we-gather-and-verify-codes | src/app/(site)/how-we-gather-and-verify-codes/page.tsx | Static verification policy. | n/a |
| /cookie-settings | src/app/(site)/cookie-settings/page.tsx | Consent controls (client component). | n/a |
