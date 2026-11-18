# Screenshot audit
Current stack: independent Next.js 16 / React 19 static export frontend, hash routing, Express backend. API contracts remain unchanged. Seven supplied screenshots inspected.

| Screenshot | Page / observation | Inspected cause | Implemented first pass | Verification |
|---|---|---|---|---|
| 131 | Obsolete keyword AI | Separate source-search screen | Keep current CloudAssistant entry; no rollback | Existing assistant tests |
| 132 | Account crowded location / header | city-list max-height 190px with overflow auto; fixed 100/110px offsets | Remove location inner scrolling, share navigation clearance, larger labels | Guest preferences matrix; authenticated account pending |
| 133 | Quran long titles / crowded Arabic | Three competing grid columns; metadata 12px | Arabic on separate row; flexible tile minimums; 13px metadata | EN/UR nine widths |
| 134 | Academy detached hero | Header bottom margin 30px, hero padding up to 58px | Compact header and hero, smaller heading | EN/UR nine widths |
| 135 | Academy card density / repeated landscapes | Track-level artwork fallback, metadata 10–13px | Readable descriptions, no fixed description minimum height; artwork pipeline | Track interactions pending |
| 136 | Dua density and search double border | Two-line Arabic clamp; inherited input border; 17px title | Unclamp Arabic, 20px titles, unified search field | EN/UR nine widths |
| 137 | AI composer below large welcome | Accumulated page gap, welcome padding and headings; unbounded thread | Compact welcome; bounded message scroll; accessible composer; latest action | Matrix + unit suite |

Header clearance is currently a shared responsive CSS value, not measured from actual header height. Drawer behavior and full collision checks still require work. No global overflow masking was added.
