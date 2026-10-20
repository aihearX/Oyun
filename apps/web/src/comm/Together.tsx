import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import { COMM_RULES, type MentorLink, type PublicProfile } from '@odi/shared';
import { act, toast } from '../net';
import { platform } from '../platform';
import { ScreenHead } from '../ui/bits';
import { Empty, ItemChips, Online, Skeleton, fmtLeft, fmtNum, useNow } from '../ui/social';
import { Art } from '../ui/art';
import { OdiAvatar } from '../ui/OdiAvatar';
import { hatKey } from '../screens/team/TeamMembers';
import { Av, infoLine } from '../friends/common';
import { openProfile } from '../friends/state';
import { useFeatures } from '../ftue/useFeatures';
import { FreeTextSheet } from './Cards';
import { refreshDuo, refreshMentor, useComm } from './state';

/** Birlikte: İkili Görev (haftalık, bir arkadaşla), Usta–Çırak ve sohbet ayarları. */
export function TogetherScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen fade-in together-screen" data-testid="birlikte">
      <ScreenHead title="Birlikte" onBack={onBack} />
      <Online what="İkili Görev ve Usta–Çırak"><Together /></Online>
    </div>
  );
}

function Together() {
  const duo = useComm((s) => s.duo); const mentor = useComm((s) => s.mentor);
  const feat = useFeatures();
  useEffect(() => { void refreshDuo(); void refreshMentor(); }, []);
  if (!duo || !mentor) return <Skeleton rows={3} />;
  const duoOpen = feat.open('ikili') || !!duo.active || duo.incoming.length > 0;
  return (
    <div className="stack">
      {duoOpen ? <DuoCard /> : <div className="card tg-card locked-card"><div className="tg-head"><span className="tg-ic"><Art name="lock" size={30} /></span><div className="min0"><h2>İkili Görev</h2><small>{feat.lock('ikili')}</small></div></div></div>}
      <MentorCard />
      <SettingsCard />
    </div>
  );
}

function DuoCard() {
  const duo = useComm((s) => s.duo)!; const me = useNet((s) => s.me);
  const now = useNow(30_000); const [busy, setBusy] = useState('');
  const invite = async (p: PublicProfile) => { setBusy(p.id); const r = await act('duo.invite', { friendId: p.id }); setBusy(''); if (r) { useComm.setState({ duo: r.duo }); platform().haptic('success'); if (!r.duo.active) toast('🤝', `${p.name} davet edildi`, 'Kabul ederse bu haftanın notaları birlikte sayılır.', 'green'); } };
  const respond = async (id: string, accept: boolean) => { setBusy(id); const r = await act('duo.respond', { inviteId: id, accept }); setBusy(''); if (r) { useComm.setState({ duo: r.duo }); if (accept && r.duo.active) { platform().haptic('success'); toast('🤝', 'İkili Görev başladı!', 'Bu hafta notalarınız birlikte sayılıyor.', 'green'); } } };
  const a = duo.active; const max = duo.tiers[duo.tiers.length - 1]!.need;
  return (
    <div className="card tg-card" data-testid="ikili-gorev">
      <div className="tg-head">
        <span className="tg-ic"><Art name="users" size={32} /></span>
        <div className="min0"><h2>İkili Görev</h2><small>Bir arkadaşınla haftalık ortak hedef · {fmtLeft(duo.endsAt - now)} kaldı</small></div>
      </div>
      {a ? <>
        <div className="duo-pair">
          {a.members.map((m, i) => (
            <div key={m.id} className="dp-m" style={{ order: i * 2 }}>
              <button type="button" className="fc-av" onClick={() => m.id !== me?.id && openProfile(m.id)} aria-label={`${m.name} profili`}><OdiAvatar size={44} color={m.color} hat={hatKey(m.hat)} /></button>
              <b>{m.id === me?.id ? 'Sen' : m.name}</b><small>{fmtNum(m.notes)} nota</small>
            </div>
          ))}
          <span className="dp-plus" style={{ order: 1 }}><Art name="plus" size={18} /></span>
        </div>
        <div className="duo-bar" role="progressbar" aria-valuenow={a.progress} aria-valuemax={max} aria-label="Ortak notalar">
          <i style={{ width: `${Math.min(100, (a.progress / max) * 100)}%` }} />
          {duo.tiers.slice(0, -1).map((t) => <span key={t.need} className="db-tick" style={{ left: `${(t.need / max) * 100}%` }} />)}
        </div>
        <div className="muted small-note"><b>{fmtNum(a.progress)}</b> / {fmtNum(max)} nota · bölümlerde topladığın her nota ikinizin hedefine sayılır.</div>
        <div className="duo-tiers">
          {a.tiers.map((t, i) => <div key={t.need} className={`duo-tier${t.reached ? ' on' : ''}`} data-testid={`ikili-kademe-${i}`} data-reached={t.reached ? '1' : '0'}><b><Art name={t.reached ? 'check' : 'chest'} size={18} /> {fmtNum(t.need)} nota</b><ItemChips items={t.reward} small /></div>)}
        </div>
      </> : <>
        <div className="muted wrap">Birlikte {fmtNum(duo.tiers[0]!.need)} nota toplayın, ortak sandığı açın; {fmtNum(max)} notada ikinci sandık. Ödüller ikinize de, aynı.</div>
        <div className="duo-tiers">{duo.tiers.map((t) => <div key={t.need} className="duo-tier"><b><Art name="chest" size={18} /> {fmtNum(t.need)} nota</b><ItemChips items={t.reward} small /></div>)}</div>
        {duo.incoming.map((inv) => (
          <div key={inv.id} className="pick-row" data-testid="ikili-davet">
            <Av p={inv.from} size={40} />
            <span className="grow"><b>{inv.from.name}</b><small>seni bu haftanın İkili Görevine çağırıyor</small></span>
            <button className="btn small" disabled={busy === inv.id} onClick={() => void respond(inv.id, true)}>Kabul</button>
            <button className="btn ghost small" disabled={busy === inv.id} onClick={() => void respond(inv.id, false)} aria-label="Reddet"><Art name="cross" size={16} /></button>
          </div>
        ))}
        {duo.outgoing.map((inv) => (
          <div key={inv.id} className="pick-row"><Av p={inv.to} size={40} /><span className="grow"><b>{inv.to.name}</b><small>davetin bekliyor</small></span><button className="btn ghost small" disabled={busy === inv.id} onClick={() => void respond(inv.id, false)}>İptal</button></div>
        ))}
        <h3 className="section-head">Arkadaşını seç</h3>
        {duo.candidates.length === 0 ? <Empty icon="👥" title="Davet edilecek arkadaş yok" text="Arkadaşlar ekranından arkadaş ekle; bu hafta görevi olmayan arkadaşların burada görünür." />
          : <div className="pick-list">{duo.candidates.map((p) => (
            <div key={p.id} className="pick-row" data-testid="ikili-aday"><Av p={p} size={40} /><span className="grow"><b>{p.name}</b><small>{infoLine(p)}</small></span><button className="btn small" data-testid="ikili-davet-et" disabled={busy === p.id} onClick={() => void invite(p)}>Davet et</button></div>
          ))}</div>}
      </>}
    </div>
  );
}

function Steps({ link }: { link: MentorLink }) {
  return (
    <div className="mentor-steps" aria-label="Dönüm noktaları">
      {COMM_RULES.mentorMilestones.map((m) => {
        const on = link.reached.includes(m); const skip = m <= link.startHighest && !on;
        return <span key={m} className={`mentor-step${on ? ' on' : ''}${link.next === m ? ' next' : ''}`} style={skip ? { opacity: 0.4 } : undefined}>{on ? <Art name="check" size={14} className="art-inline" /> : null} {m}. bölüm</span>;
      })}
    </div>
  );
}

function MentorCard() {
  const m = useComm((s) => s.mentor)!;
  const [busy, setBusy] = useState('');
  const run = async <T,>(id: string, p: Promise<T | null>, ok?: string) => { setBusy(id); const r = await p; setBusy(''); if (r && (r as { mentor?: unknown }).mentor) { useComm.setState({ mentor: (r as unknown as { mentor: typeof m }).mentor }); platform().haptic('success'); if (ok) toast('🤝', ok, undefined, 'green'); } };
  const offer = (p: PublicProfile, as: 'usta' | 'cirak') => void run(p.id, act('mentor.offer', { id: p.id, as }), as === 'usta' ? `${p.name} için çırak teklifin gitti` : `${p.name} kişisine ustam ol dedin`);
  const role = m.canMentor ? 'usta' : m.canBeApprentice ? 'cirak' : null;
  return (
    <div className="card tg-card" data-testid="usta-cirak">
      <div className="tg-head">
        <span className="tg-ic"><Art name="crown" size={32} /></span>
        <div className="min0"><h2>Usta–Çırak</h2><small>{m.canMentor ? `Sen bir ustasın · ${m.apprentices.length}/${COMM_RULES.mentorMaxApprentices} çırak` : m.mentor ? `Ustan: ${m.mentor.mentor.name}` : 'Deneyimli bir arkadaş yeni başlayana yol gösterir'}</small></div>
      </div>
      <div className="muted small-note">Çırak {COMM_RULES.mentorMilestones.join(', ')}. bölüme ulaştıkça ikiniz de ödül alırsınız (yalnız bağdan sonraki dönüm noktaları). Çırak: <ItemChips items={m.rewards.apprentice} small /> · Usta: <ItemChips items={m.rewards.mentor} small /></div>
      {m.incoming.map((o) => {
        const who = o.by === o.mentor.id ? o.mentor : o.apprentice;
        return (
          <div key={o.id} className="pick-row" data-testid="usta-teklif"><Av p={who} size={40} />
            <span className="grow"><b>{who.name}</b><small>{o.by === o.mentor.id ? 'sana usta olmak istiyor' : 'ustası olmanı istiyor'}</small></span>
            <button className="btn small" data-testid="usta-kabul" disabled={busy === o.id} onClick={() => void run(o.id, act('mentor.respond', { offerId: o.id, accept: true }), 'Usta–Çırak bağı kuruldu!')}>Kabul</button>
            <button className="btn ghost small" disabled={busy === o.id} onClick={() => void run(o.id, act('mentor.respond', { offerId: o.id, accept: false }))} aria-label="Reddet"><Art name="cross" size={16} /></button>
          </div>
        );
      })}
      {m.mentor && (
        <div className="pick-row" data-testid="ustam"><Av p={m.mentor.mentor} size={40} /><span className="grow"><b>Ustan {m.mentor.mentor.name}</b><small>{m.mentor.next ? `Sıradaki dönüm noktası: ${m.mentor.next}. bölüm` : 'Hepsi tamam!'}</small></span></div>
      )}
      {m.mentor && <Steps link={m.mentor} />}
      {m.apprentices.map((l) => (
        <div key={l.id} className="stack tight" data-testid="cirak">
          <div className="pick-row"><Av p={l.apprentice} size={40} /><span className="grow"><b>{l.apprentice.name}</b><small>{l.apprentice.highest}. bölümde · sıradaki {l.next ?? '—'}</small></span>
            <button className="btn ghost small" disabled={busy === l.id} onClick={() => void run(l.id, act('mentor.end', { linkId: l.id }))}>Bitir</button></div>
          <Steps link={l} />
        </div>
      ))}
      {m.outgoing.map((o) => { const who = o.by === o.mentor.id ? o.apprentice : o.mentor; return <div key={o.id} className="pick-row"><Av p={who} size={40} /><span className="grow"><b>{who.name}</b><small>teklifin bekliyor</small></span><button className="btn ghost small" disabled={busy === o.id} onClick={() => void run(o.id, act('mentor.respond', { offerId: o.id, accept: false }))}>İptal</button></div>; })}
      {role && (m.canMentor ? m.apprentices.length < COMM_RULES.mentorMaxApprentices : !m.mentor) && <>
        <h3 className="section-head">{role === 'usta' ? 'Çırak olabilecek arkadaşların' : 'Ustan olabilecek arkadaşların'}</h3>
        {m.candidates.length === 0 ? <div className="muted small-note">{role === 'usta' ? `Arkadaş ya da takım arkadaşı olan, henüz ${COMM_RULES.apprenticeMaxHighest + 1}. bölüme ulaşmamış oyuncular burada görünür.` : `En az ${COMM_RULES.mentorMinHighest - 1} bölüm geçmiş arkadaş ya da takım arkadaşları burada görünür.`}</div>
          : <div className="pick-list">{m.candidates.map((p) => (
            <div key={p.id} className="pick-row" data-testid="usta-aday"><Av p={p} size={40} /><span className="grow"><b>{p.name}</b><small>{infoLine(p)}</small></span>
              <button className="btn small" data-testid="usta-teklif-et" disabled={busy === p.id} onClick={() => offer(p, role)}>{role === 'usta' ? 'Çırak teklif et' : 'Ustam ol'}</button></div>
          ))}</div>}
      </>}
      {!role && !m.mentor && !m.apprentices.length && <div className="muted small-note">Usta olmak için {COMM_RULES.mentorMinHighest - 1} bölüm geç; o zamana kadar bir ustadan yardım alabilirsin (çırak en çok {COMM_RULES.apprenticeMaxHighest}. bölümde olabilir).</div>}
    </div>
  );
}

function SettingsCard() {
  const st = useComm((s) => s.settings);
  const [sheet, setSheet] = useState(false);
  if (!st) return null;
  const set = async (d: { freeText?: boolean; feedShare?: boolean }) => { const r = await act('comm.settings', d); if (r) useComm.setState({ settings: r.settings }); };
  return (
    <div className="card tg-card" data-testid="sohbet-ayarlari">
      <div className="tg-head"><span className="tg-ic"><Art name="chat" size={30} /></span><div className="min0"><h2>Sohbet ayarları</h2><small>Görünürlüğün ve güvenliğin sende</small></div></div>
      <div className="tg-toggle"><span className="grow"><b>Başarılarım akışta görünsün</b><small>Bölüm, boss, koklea ve kamp başarıların takım sohbetine kart olarak düşer.</small></span>
        <button type="button" className="switch" role="switch" aria-checked={st.feedShare} aria-label="Başarılarım akışta görünsün" onClick={() => void set({ feedShare: !st.feedShare })} /></div>
      <div className="tg-toggle"><span className="grow"><b>Serbest yazı</b><small>{st.canFreeText && !st.freeText ? `${st.freeTextLevel}. bölüme ulaştığın için açık.` : `${st.freeTextLevel}. bölüme kadar hazır sözler; istersen şimdi aç.`}</small></span>
        <button type="button" className="switch" role="switch" aria-checked={st.canFreeText} disabled={st.canFreeText && !st.freeText} aria-label="Serbest yazı" onClick={() => (st.freeText ? void set({ freeText: false }) : setSheet(true))} /></div>
      {sheet && <FreeTextSheet onClose={() => setSheet(false)} />}
    </div>
  );
}
