import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import {
  COMM_RULES, TEAM_APPLY_NOTES, TEAM_APPLY_RULES, TEAM_LEAGUE_TIERS, applyNoteText,
  type TeamBrowseRow, type TeamLeagueTier, type TeamProfile, type TeamRole,
} from '@odi/shared';
import { act, errText, getNet, toast } from '../../net';
import { platform } from '../../platform';
import { Sheet, fmtLeft, fmtNum, useNow } from '../../ui/social';
import { Art, type ArtName } from '../../ui/art';
import { OdiAvatar } from '../../ui/OdiAvatar';
import { openProfile } from '../../friends/state';
import { useComm } from '../../comm/state';
import { hatKey } from './TeamMembers';
import { bumpBrowse, closeTeamProfile, refreshMine, useTeamApply } from './apply';
import './team-apply.css';
import { RozetMini } from '../../kurucu/rozet';

/**
 * Takım bulma ve başvuru (docs/16-takim-rekabeti.md): satır/profil düğmesi (Katıl · Başvur · Başvuru gönderildi · Dolu · N. bölümden sonra),
 * başvuru sayfası (hazır notlar; serbest yazı 8 bölümden sonra) ve her yerden açılan salt okunur takım profili (`openTeamProfile(id)`).
 */
export const TIER_ART: Record<TeamLeagueTier, ArtName> = { bronz: 'medal3', gumus: 'medal2', altin: 'medal1', platin: 'medal', koklea: 'shell' };
export const tierName = (t: TeamLeagueTier) => TEAM_LEAGUE_TIERS.find((x) => x.id === t)?.name ?? 'Bronz';
const ROLE: Record<TeamRole, { art: ArtName | null; label: string }> = { lider: { art: 'crown', label: 'Lider' }, yardimci: { art: 'star', label: 'Yardımcı' }, uye: { art: null, label: 'Üye' } };

/** katılım modu etiketi (ikonlu) */
export function ModeTag({ open }: { open: boolean }) {
  return <span className={`ta-mode ${open ? 'acik' : 'basvuru'}`} data-testid="katilim-modu"><Art name={open ? 'door' : 'mail'} size={14} />{open ? 'Açık' : 'Başvuruyla'}</span>;
}

function stateLabel(t: TeamBrowseRow, now: number): string {
  switch (t.state) {
    case 'katil': return 'Katıl';
    case 'basvur': return 'Başvur';
    case 'gonderildi': return 'Başvuru gönderildi';
    case 'dolu': return 'Dolu';
    case 'seviye': return `${t.minLevel}. bölümden sonra`;
    case 'bekle': return t.until ? `${fmtLeft(t.until - now)} sonra` : 'Sonra yeniden dene';
    case 'sinir': return `En çok ${TEAM_APPLY_RULES.maxPending} başvuru`;
    case 'uye': return 'Takımın';
    case 'takimda': return 'Takımın var';
    default: return t.open ? 'Katıl' : 'Başvur';
  }
}

/** Katıl / Başvur düğmesi (satır ve profil aynı mantık; durum sunucudan) */
export function JoinButton({ t, block, onChanged }: { t: TeamBrowseRow; block?: boolean; onChanged?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const now = useNow(30_000);
  const state = t.state ?? (t.open ? 'katil' : 'basvur');
  const join = async () => {
    setBusy(true);
    const r = await act('team.join', { teamId: t.id });
    setBusy(false);
    if (!r) { onChanged?.(); return; }
    useNet.setState({ team: r.team });
    platform().haptic('success');
    toast('🎉', `${r.team.name} takımına hoş geldin!`, 'Sohbette bir merhaba de.', 'green');
    closeTeamProfile();
  };
  const active = state === 'katil' || state === 'basvur';
  const cls = `btn small ta-join s-${state}${block ? ' block' : ''}`;
  return (
    <>
      <button type="button" className={cls} disabled={!active || busy} data-testid="takim-katil" data-state={state}
        onClick={(e) => { e.stopPropagation(); if (state === 'katil') void join(); else if (state === 'basvur') setApplying(true); }}>
        {state === 'gonderildi' ? <Art name="hourglass" size={16} /> : state === 'seviye' || state === 'bekle' ? <Art name="lock" size={16} /> : state === 'basvur' ? <Art name="mail" size={16} /> : null}
        <span>{busy ? 'Katılıyor…' : stateLabel(t, now)}</span>
      </button>
      {applying && <ApplySheet t={t} onClose={() => setApplying(false)} onDone={() => { setApplying(false); onChanged?.(); }} />}
    </>
  );
}

/** başvuru sayfası: hazır not (herkes) ya da kendi notun (serbest yazı açıksa) */
export function ApplySheet({ t, onClose, onDone }: { t: TeamBrowseRow; onClose: () => void; onDone: () => void }) {
  const canFree = useComm((s) => s.settings?.canFreeText ?? false);
  const freeAt = useComm((s) => s.settings?.freeTextLevel ?? COMM_RULES.freeTextLevel);
  const [noteId, setNoteId] = useState<string>(TEAM_APPLY_NOTES[0]!.id);
  const [own, setOwn] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!useComm.getState().settings) void getNet()?.call('comm.state', {}).then((r) => useComm.setState({ settings: r.settings })).catch(() => undefined); }, []);
  const send = async () => {
    const c = getNet(); if (!c) return;
    setBusy(true); setErr('');
    try {
      await c.call('team.apply', own && text.trim() ? { teamId: t.id, note: text.trim() } : { teamId: t.id, noteId });
      platform().haptic('success');
      toast('✉️', 'Başvurun gönderildi', `${t.name} onaylayınca takıma katılırsın.`, 'green');
      bumpBrowse(); void refreshMine();
      onDone();
    } catch (e) { setErr(errText(e)); platform().haptic('error'); }
    setBusy(false);
  };
  return (
    <Sheet title={`${t.name} takımına başvur`} onClose={onClose}>
      <div className="ta-apply" data-testid="basvuru-sayfasi">
        <div className="muted small-note">Takımın lideri ve yardımcıları başvurunu görür ve onaylar. Aynı anda en çok {TEAM_APPLY_RULES.maxPending} takıma başvurabilirsin; yanıt gelmezse başvuru 7 günde düşer.</div>
        <div className="ta-notes" role="radiogroup" aria-label="Başvuru notu">
          {TEAM_APPLY_NOTES.map((n) => (
            <button key={n.id} type="button" role="radio" aria-checked={!own && noteId === n.id} className={`chip-btn ta-note${!own && noteId === n.id ? ' on' : ''}`} data-note={n.id} onClick={() => { setOwn(false); setNoteId(n.id); }}>{n.text}</button>
          ))}
          {canFree && <button type="button" role="radio" aria-checked={own} className={`chip-btn ta-note${own ? ' on' : ''}`} data-note="kendi" onClick={() => setOwn(true)}><Art name="pencil" size={16} /> Kendi notumu yazayım</button>}
        </div>
        {own && canFree && <label className="field"><span>Notun <i className="muted">({[...text].length}/{TEAM_APPLY_RULES.noteMax})</i></span><textarea className="input ta-text" value={text} maxLength={TEAM_APPLY_RULES.noteMax} rows={3} onChange={(e) => setText(e.target.value)} placeholder="ör. Her akşam oynuyorum, savaşa katkı veririm." aria-label="Başvuru notu" /></label>}
        {!canFree && <div className="muted small-note ta-free-note"><Art name="lock" size={14} /> Kendi notunu yazmak {freeAt}. bölümden sonra açılır; o zamana kadar hazır notlardan birini seç.</div>}
        {err && <div className="chat-err" role="alert">{err}</div>}
        <button className="btn" disabled={busy || (own && !text.trim())} onClick={() => void send()} data-testid="basvuru-gonder"><Art name="mail" size="1.15em" className="art-inline" /> {busy ? 'Gönderiliyor…' : 'Başvuruyu gönder'}</button>
      </div>
    </Sheet>
  );
}

export function TeamProfileHost() {
  const id = useTeamApply((s) => s.profileId);
  if (!id) return null;
  return <TeamProfileSheet key={id} id={id} />;
}

function TeamProfileSheet({ id }: { id: string }) {
  const [t, setT] = useState<TeamProfile | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const stamp = useTeamApply((s) => s.stamp);
  const myTeam = useNet((s) => s.team?.id ?? null);
  const load = () => { const c = getNet(); if (!c) return; c.call('team.profile', { teamId: id }).then((r) => { setT(r.team); setErr(''); }, (e) => setErr(errText(e))); };
  useEffect(load, [id, stamp, myTeam]);
  const cancel = async () => {
    if (!t?.applicationId) return;
    setBusy(true);
    const r = await act('team.apply.cancel', { applicationId: t.applicationId });
    setBusy(false);
    if (r) { toast('↩️', 'Başvurun geri çekildi', `${t.name} artık başvurunu görmüyor.`); bumpBrowse(); void refreshMine(); }
  };
  if (!t) {
    return <Sheet onClose={closeTeamProfile}>{err ? <div className="chat-err" role="alert">{err}</div> : <div className="fr-card-skel" aria-busy="true" aria-label="Takım yükleniyor"><i /><b /><b /></div>}</Sheet>;
  }
  const tier = t.leagueTier ?? 'bronz';
  return (
    <Sheet title="Takım profili" onClose={closeTeamProfile}>
      <div className="ta-profile" data-testid="takim-profili" data-team={t.id}>
        <div className="ta-hero">
          <span className="ta-emblem" data-ugc aria-hidden>{t.emblem}</span>
          <div className="min0 grow">
            <h2 className="ellipsis">{t.name}</h2>
            <div className="ta-tags"><ModeTag open={t.open} />{t.minLevel > 1 && <span className="ta-mode"><Art name="unlock" size={14} />{t.minLevel}. bölüm</span>}</div>
          </div>
        </div>
        {t.description ? <div className="ta-desc wrap" data-ugc>{t.description}</div> : <div className="ta-desc muted">Takım açıklaması yok.</div>}
        <div className="ta-stats">
          <span><Art name="trophy" size={22} /><b>{t.rank ? `${t.rank}.` : '–'}</b><small>sıralama</small></span>
          <span><Art name="bolt" size={22} /><b>{fmtNum(t.rankPower ?? 0)}</b><small>takım gücü</small></span>
          <span><Art name="users" size={22} /><b>{t.members}/{t.max}</b><small>üye</small></span>
          <span><Art name={TIER_ART[tier]} size={22} /><b>{tierName(tier)}</b><small>lig</small></span>
        </div>
        <div className="ta-action">
          <JoinButton t={t} block onChanged={load} />
          {t.state === 'gonderildi' && <button type="button" className="btn ghost small block" disabled={busy} onClick={() => void cancel()} data-testid="basvuru-geri-cek">Başvuruyu geri çek</button>}
          {t.state === 'seviye' && <div className="muted small-note">Bu takım en az {t.minLevel}. bölüme ulaşmış oyuncuları alıyor.</div>}
          {t.state === 'bekle' && <div className="muted small-note">Reddedilen ya da geri çekilen başvurudan sonra aynı takıma bir süre başvurulamaz.</div>}
          {t.state === 'sinir' && <div className="muted small-note">Bekleyen başvurularından birini geri çekersen yeni başvuru yapabilirsin.</div>}
        </div>
        <div className="row between"><b>Üyeler</b><span className="muted">{t.members}/{t.max}</span></div>
        <ul className="ta-roster" aria-label="Üyeler">
          {t.roster.map((m) => (
            <li key={m.id}>
              <button type="button" className="ta-mem" onClick={() => { closeTeamProfile(); openProfile(m.id); }} aria-label={`${m.name}, ${ROLE[m.role].label}`}>
                <OdiAvatar size={34} color={m.color} hat={hatKey(m.hat)} />
                <span className="grow min0 ellipsis">{m.name}</span>
                <RozetMini p={m} />
                {m.role !== 'uye' && <span className={`role-badge ${m.role}`}>{ROLE[m.role].art && <Art name={ROLE[m.role].art!} size={12} />} {ROLE[m.role].label}</span>}
                <span className="muted ta-lvl">{m.highest}. bölüm</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}

/** başvuru notunun metni (hazır not kimliği ya da serbest yazı) */
export const noteText = (a: { note: string; noteKind: 'hazir' | 'serbest' | 'yok' }) => (a.noteKind === 'hazir' ? applyNoteText(a.note) : a.noteKind === 'serbest' ? a.note : '');
