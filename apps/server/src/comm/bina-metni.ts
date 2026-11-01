/**
 * Takım Akışı kamp kartının cümlesi (YN-071). Saf işlev: feed.ts ve kayıtlı kartları düzelten göç (migrations.ts) aynı cümleyi kurar.
 * Öğe biçimi (feed_recent ve kart meta'sında saklanır, değişmedi): "Bina kurdu" ya da "Bina N. seviye".
 */
interface BinaOgesi { name: string; level: number }
function oge(s: string): BinaOgesi {
  const kur = /^(.+) kurdu$/.exec(s); if (kur) return { name: kur[1]!, level: 1 };
  const sv = /^(.+) (\d+)\. seviye$/.exec(s); if (sv) return { name: sv[1]!, level: Number(sv[2]) };
  return { name: s, level: 0 };
}

/** "DrMelis kampında Timpanometri Kulesi kurdu." / "… Kulak Kepçesi yapısını 3. seviyeye yükseltti." / "… 2 binayı geliştirdi: X (yeni), Y (3. seviye)." */
export function binaMetni(name: string, items: string[]): string {
  const b = items.map(oge);
  if (b.length > 1) return `${name} kampında ${b.length} binayı geliştirdi: ${b.map((x) => (x.level === 1 ? `${x.name} (yeni)` : x.level > 1 ? `${x.name} (${x.level}. seviye)` : x.name)).join(', ')}.`;
  const x = b[0];
  if (!x) return `${name} kampında bir binayı geliştirdi.`;
  if (x.level === 1) return `${name} kampında ${x.name} kurdu.`;
  if (x.level > 1) return `${name} kampında ${x.name} yapısını ${x.level}. seviyeye yükseltti.`;
  return `${name} kampında bir binayı geliştirdi: ${x.name}.`;
}
