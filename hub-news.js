// "Zanimljivo za posao": an occasional business news card on the hub home page (Tadija, 28. 11. 2026).
// Only the newest entry for the viewer's company is shown, until the next one is added.
// HOW TO ADD: put a new entry at the TOP with a new `id` (date + letter). `companies` limits who sees it
// ("tadex" / "strong" / "ruyi"); leave it out for everyone. Keep `text` to two or three short sentences.
// Set `until` (YYYY-MM-DD) when the news stops being useful; after that day the card hides itself.

export const HUB_NEWS = [
  {
    id: "2026-11-28a", date: "28. 11. 2026.", until: "2027-02-06",
    title: "Kineska Nova godina je 6. 2. 2027.",
    text: "Fabrike u Kini staju 2 do 4 sedmice. Sve što treba stići do marta potvrdite s kupcem i fabrikom do 10. 1.",
    link: { href: "/praznici/", label: "Pogledaj u kalendaru" },
  },
];

/** Newest entry the viewer may see that is still current, or null. Pure (tested). */
export function currentNews(companies, todayIso, list = HUB_NEWS) {
  const mine = new Set(companies || []);
  return list.find(n => (!n.companies || n.companies.some(c => mine.has(c))) && (!n.until || n.until >= todayIso)) || null;
}
