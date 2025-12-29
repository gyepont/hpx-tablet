# AI LOG

## 2025-12-28 06:31:48 — MDT: BOLO/Evidence lépés

```
IDE bemásolod AZT, AMIT ÉN ÍRTAM NEKED (a teljes választ / cat blokkokat is)
```


## 2025-12-28 16:59:01 — Fejlesztés: <rövid cím>

```
IDE JÖN AZ ÉN ÖSSZEFOGLALÓM + A CAT BLOKKOK / LÉPÉSEK
```


## 2025-12-28 17:47:25 — MDT: következő lépés

```
- Mit csináltunk:
  - ...
- Miért:
  - ...
- Következő:
  - ...
```


## 2025-12-29 03:27:40 — Fix: MDT build (kommentek kiszedve + allowDrop)

```
- MdtApp.tsx: minden /* ... */ blokk komment eltávolítva (JSX-ban is).
- Hibás "{ { ..." minták javítva (style={{}} nem sérül).
- allowDrop: ha csak deklarált volt és nem használt, törölve (TS6133 fix).
```


## 2025-12-29 04:41:54 — Evidence app (MVP)

```
- Új tablet app: Bizonyítékok (csak police/admin)
- Lista + kereső + szűrők (státusz/típus)
- Részletek: cím, jegyzet, tagek, kapcsolt report ID-k
- Átadás (chain-of-custody) + lezárás (sealed → read-only)
- Timeline megjelenítés
```

