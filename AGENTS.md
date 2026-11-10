# Architecture rules

- Fetch complete movement and deletion histories in ordered Data API pages via `fetchAllPages`; a single capped request silently hides older records.