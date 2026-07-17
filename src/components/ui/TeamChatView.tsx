'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Team, Profile, Message, useMessages, useTeamDocuments, hrActions, displayName } from '@/lib/hrData';
import { Avatar } from './Avatar';
import { TeamDocumentsPanel } from './TeamDocumentsPanel';
import { Send, Paperclip, FileText, Download, ShieldCheck, Loader2, Crown, Search, SlidersHorizontal, X, Megaphone, MessageCircle, FolderOpen, Smile } from 'lucide-react';

// Curated, no-dependency emoji set for the composer's emoji picker — avoids
// pulling in an emoji-picker package (and its bundle size / build-tool
// dependency) just for this. Grouped loosely so the picker doesn't read as
// a random wall of glyphs; browsers/OSes render these as native emoji, no
// image assets needed.
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: 'Smileys', emojis: ['😀', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🙃', '😍', '🥰', '😘', '😜', '🤔', '🤨', '😐', '😑', '😴', '🥱', '😷', '🤒'] },
  { label: 'Gestures', emojis: ['👍', '👎', '👏', '🙌', '🙏', '💪', '🤝', '✌️', '🤞', '👌', '👋', '🤙', '✋'] },
  { label: 'Hearts', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💯', '✨', '🔥', '⭐'] },
  { label: 'Work', emojis: ['✅', '❌', '⚠️', '📌', '📎', '📅', '⏰', '💼', '📈', '📉', '💰', '🎯', '🚀', '🛠️', '📝', '📦', '🚚', '☕'] },
  { label: 'Reactions', emojis: ['🎉', '👀', '💡', '🙌', '😢', '😡', '😮', '🤝', '👏', '🥳'] },
];

function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  // Only Escape is handled here. Outside-click is handled one level up by
  // the toggle button's own wrapper (see emojiWrapperRef below) — doing it
  // here too would race with the toggle button's onClick: mousedown closes
  // the picker first, then the button's click re-opens it, so the button
  // would appear to do nothing when clicked while the picker is open.
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      className="absolute bottom-full right-0 mb-1 w-64 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-20 p-2.5 space-y-2"
    >
      {EMOJI_GROUPS.map(group => (
        <div key={group.label}>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-0.5 mb-1">{group.label}</p>
          <div className="grid grid-cols-8 gap-0.5">
            {group.emojis.map(emoji => (
              <button
                key={emoji}
                type="button"
                onMouseDown={e => { e.preventDefault(); onPick(emoji); }}
                className="text-lg leading-none p-1 rounded-lg hover:bg-slate-100 transition-colors active:scale-90"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface TeamChatViewProps {
  teams: Team[];
  currentUserEmail: string;
  currentUserRole: 'admin' | 'hr' | 'employee' | 'team_lead';
  allProfiles: Profile[];
  // Admin's dedicated Team Chats page: sees every team (not just their own),
  // and shows a "you're viewing every channel" label. Admin can still post
  // in any of them — see the Crown/highlight styling below for how their
  // messages are made unmistakable to everyone else in the channel.
  oversight?: boolean;
}

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // matches the collection's maxSize

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return sameDay ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`;
  } catch {
    return iso;
  }
}

function isImageAttachment(name?: string): boolean {
  if (!name) return false;
  return /\.(png|jpe?g|gif|webp)$/i.test(name);
}

type FileTypeFilter = 'all' | 'image' | 'document' | 'other' | 'none' | 'announcement';
type SizeFilter = 'all' | 'small' | 'medium' | 'large';

function attachmentKind(name?: string): 'image' | 'document' | 'other' | 'none' {
  if (!name) return 'none';
  if (isImageAttachment(name)) return 'image';
  if (/\.(pdf|docx?|xlsx?|txt)$/i.test(name)) return 'document';
  return 'other';
}

function formatBytes(bytes?: number): string {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Small (<1MB) / Medium (1-5MB) / Large (>5MB) — coarse buckets, matches
// the sizes people actually think in rather than exact byte ranges.
function sizeBucket(bytes?: number): SizeFilter {
  if (!bytes && bytes !== 0) return 'all';
  if (bytes < 1024 * 1024) return 'small';
  if (bytes < 5 * 1024 * 1024) return 'medium';
  return 'large';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Highlights "@Display Name" mentions AND "#Document Title" tags in message
// text. Doc tags are matched against whichever documents currently exist
// for this team (same "resolve live, don't trust the snapshot" approach as
// mentions) and render as clickable links straight to the file — that's
// the "tag a document to ask questions about it" feature: typing #Title in
// chat both highlights it and opens the doc for anyone reading the thread.
function renderMessageText(
  text: string,
  mentionLabels: string[],
  docTags: { title: string; url: string }[],
  onColoredBubble: boolean
): React.ReactNode {
  if (!text) return null;
  const mentionSet = new Set(mentionLabels.map(l => `@${l}`));
  const docByTag = new Map(docTags.map(d => [`#${d.title}`, d.url]));
  if (mentionSet.size === 0 && docByTag.size === 0) return text;

  const mentionAlt = [...mentionLabels].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const docAlt = docTags.map(d => d.title).sort((a, b) => b.length - a.length).map(escapeRegExp);
  const patterns = [
    ...(mentionAlt.length ? [`@(?:${mentionAlt.join('|')})`] : []),
    ...(docAlt.length ? [`#(?:${docAlt.join('|')})`] : []),
  ];
  const re = new RegExp(`(${patterns.join('|')})`, 'g');
  const parts = text.split(re);
  const mentionClass = onColoredBubble
    ? 'font-bold bg-white/25 rounded px-1'
    : 'font-bold text-orange-700 bg-orange-100 rounded px-1';
  const docClass = onColoredBubble
    ? 'font-bold bg-white/25 rounded px-1 underline underline-offset-2 cursor-pointer'
    : 'font-bold text-sky-700 bg-sky-100 rounded px-1 underline underline-offset-2 cursor-pointer';
  return parts.map((part, i) => {
    if (mentionSet.has(part)) return <span key={i} className={mentionClass}>{part}</span>;
    const docUrl = docByTag.get(part);
    if (docUrl) {
      return (
        <a key={i} href={docUrl} target="_blank" rel="noreferrer" className={docClass}>
          {part}
        </a>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export function TeamChatView({ teams, currentUserEmail, currentUserRole, allProfiles, oversight = false }: TeamChatViewProps) {
  const [activeTeamId, setActiveTeamId] = useState<string | null>(teams[0]?.id || null);
  const [draft, setDraft] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  // @mention autocomplete — `mention` is null when the dropdown is closed,
  // otherwise tracks the query typed after "@" and where that "@" is in
  // `draft` so a picked suggestion can replace exactly that span.
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  // Profiles picked from the dropdown this compose session, so on send we
  // know exactly who to notify — far more reliable than re-parsing text.
  const [mentionedProfiles, setMentionedProfiles] = useState<Map<string, Profile>>(new Map());
  // "#" document-tag autocomplete — same idea as @mention above, but for
  // referencing a Team Document instead of a person. Mirrors `mention`'s
  // shape (query + where the "#" trigger sits in `draft`).
  const [docTag, setDocTag] = useState<{ query: string; start: number } | null>(null);
  // Which panel is showing: the chat thread, or the Team Documents library
  // for the active team.
  const [activePanel, setActivePanel] = useState<'chat' | 'documents'>('chat');
  // Composer's "send as Announcement" toggle.
  const [draftIsAnnouncement, setDraftIsAnnouncement] = useState(false);
  // Search & filter panel.
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>('all');
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>('all');
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const emojiWrapperRef = useRef<HTMLDivElement>(null);

  // Closes the emoji picker on an outside click. Lives up here (wrapping
  // both the toggle button and the panel) rather than inside EmojiPicker
  // itself so a click on the toggle button isn't treated as "outside" —
  // see the comment on EmojiPicker above.
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleOutside = (e: MouseEvent) => {
      if (emojiWrapperRef.current && !emojiWrapperRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showEmojiPicker]);

  useEffect(() => {
    if (!activeTeamId && teams.length > 0) setActiveTeamId(teams[0].id);
  }, [teams, activeTeamId]);

  const { data: messages = [], isLoading } = useMessages(activeTeamId);
  const { data: teamDocuments = [] } = useTeamDocuments(activeTeamId);
  const docTagList = teamDocuments.map(d => ({ title: d.title, url: d.fileUrl }));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, activeTeamId]);

  // Reset search/filter state when switching teams — a filter set up for
  // one channel isn't necessarily meaningful in another.
  useEffect(() => {
    setSearchQuery(''); setDateFrom(''); setDateTo('');
    setFileTypeFilter('all'); setSizeFilter('all'); setShowFilters(false);
  }, [activeTeamId]);

  // Reset the composer's mention state when switching teams so a stale
  // dropdown/selection from one channel can't bleed into another.
  useEffect(() => {
    setMention(null);
    setMentionedProfiles(new Map());
    setDocTag(null);
    setShowEmojiPicker(false);
  }, [activeTeamId]);

  const emailToProfile = new Map(allProfiles.map(p => [p.email.toLowerCase(), p]));

  const hasActiveFilters = !!(searchQuery || dateFrom || dateTo || fileTypeFilter !== 'all' || sizeFilter !== 'all');

  const filteredMessages = messages.filter(m => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const senderMatch = m.senderName.toLowerCase().includes(q) || emailToProfile.get(m.senderEmail.toLowerCase())?.alias?.toLowerCase().includes(q);
      const textMatch = (m.text || '').toLowerCase().includes(q);
      const fileMatch = (m.attachmentName || '').toLowerCase().includes(q);
      if (!senderMatch && !textMatch && !fileMatch) return false;
    }
    if (dateFrom && new Date(m.timestamp) < new Date(dateFrom)) return false;
    if (dateTo && new Date(m.timestamp) > new Date(`${dateTo}T23:59:59`)) return false;
    if (fileTypeFilter === 'announcement' && !m.isAnnouncement) return false;
    if (fileTypeFilter !== 'all' && fileTypeFilter !== 'announcement' && attachmentKind(m.attachmentName) !== fileTypeFilter) return false;
    if (sizeFilter !== 'all' && sizeBucket(m.attachmentSize) !== sizeFilter) return false;
    return true;
  });

  const announcements = messages.filter(m => m.isAnnouncement);

  const activeTeam = teams.find(t => t.id === activeTeamId);
  // Who can upload/delete Team Documents for the active team: Admin and HR
  // always, a Team Lead only for a team they actually lead (not just any
  // team they happen to be shown, and not a regular member).
  const canManageDocuments =
    currentUserRole === 'admin' ||
    currentUserRole === 'hr' ||
    (currentUserRole === 'team_lead' && !!activeTeam?.leadEmail && activeTeam.leadEmail.toLowerCase() === currentUserEmail.toLowerCase());
  // Who can be @mentioned in this channel: everyone currently on the team,
  // plus every Admin (they can post — and therefore be mentioned — in any
  // team's chat even without being a formal member). Deliberately includes
  // the current viewer too — this list doubles as the "who to highlight"
  // list when rendering already-sent messages, and excluding yourself
  // would mean a message mentioning you never gets highlighted in your own
  // view. Resolved live so it stays correct as team membership/roles/
  // aliases change after the fact.
  const mentionCandidates: Profile[] = (() => {
    const emails = new Set((activeTeam?.members || []).map(e => e.toLowerCase()));
    allProfiles.forEach(p => { if (p.role === 'admin') emails.add(p.email.toLowerCase()); });
    return [...emails].map(e => emailToProfile.get(e)).filter((p): p is Profile => !!p);
  })();
  const mentionLabels = mentionCandidates.map(p => displayName(p, currentUserRole));
  // Composer dropdown specifically excludes yourself — mentioning yourself
  // isn't useful.
  const mentionDropdownCandidates = mentionCandidates.filter(p => p.email.toLowerCase() !== currentUserEmail.toLowerCase());

  // Resolve the sender label live through the current profile/alias, not
  // the stored senderName snapshot — so a later Alias edit applies
  // retroactively to old messages too. Falls back to the snapshot if the
  // profile can't be found (e.g. the sender was since deleted).
  const senderLabel = (m: Message): string => {
    const profile = emailToProfile.get(m.senderEmail.toLowerCase());
    if (profile) return displayName(profile, currentUserRole);
    // Sender profile no longer exists (e.g. deleted employee) — fall back
    // to the real-name snapshot regardless of viewer role. This is a rare
    // edge case, not a fresh privacy leak: the alias-masking guarantee only
    // ever applied to accounts that still exist.
    return m.senderName;
  };

  const handleFilePick = (file: File | undefined) => {
    setSendError('');
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setSendError('File is too large — 15MB max.');
      return;
    }
    setPendingFile(file);
  };

  // Filtered dropdown suggestions for the current "@query".
  const mentionSuggestions = mention
    ? mentionDropdownCandidates
        .filter(p => displayName(p, currentUserRole).toLowerCase().startsWith(mention.query.toLowerCase()))
        .slice(0, 6)
    : [];

  // Filtered dropdown suggestions for the current "#query" — documents in
  // this team whose title starts with (or contains) what's typed.
  const docTagSuggestions = docTag
    ? teamDocuments
        .filter(d => d.title.toLowerCase().includes(docTag.query.toLowerCase()))
        .slice(0, 6)
    : [];

  const handleDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart ?? value.length;
    setDraft(value);

    const upToCursor = value.slice(0, cursor);
    const atIndex = upToCursor.lastIndexOf('@');
    const hashIndex = upToCursor.lastIndexOf('#');
    // Whichever trigger char sits closer to the cursor wins — lets someone
    // switch from typing a mention to a doc tag (or vice versa) without the
    // stale trigger's dropdown lingering.
    const triggerIndex = Math.max(atIndex, hashIndex);
    if (triggerIndex === -1) { setMention(null); setDocTag(null); return; }
    const between = upToCursor.slice(triggerIndex + 1, cursor);
    // Bail out once the trigger is followed by whitespace — that's a
    // finished word, not an in-progress mention/tag anymore.
    if (/\s/.test(between)) { setMention(null); setDocTag(null); return; }
    if (triggerIndex === atIndex) {
      setMention({ query: between, start: atIndex });
      setDocTag(null);
    } else {
      setDocTag({ query: between, start: hashIndex });
      setMention(null);
    }
  };

  const pickMention = (profile: Profile) => {
    if (!mention) return;
    const label = displayName(profile, currentUserRole);
    const cursor = textareaRef.current?.selectionStart ?? draft.length;
    const before = draft.slice(0, mention.start);
    const after = draft.slice(cursor);
    const inserted = `@${label} `;
    const newValue = `${before}${inserted}${after}`;
    setDraft(newValue);
    setMentionedProfiles(prev => new Map(prev).set(profile.email.toLowerCase(), profile));
    setMention(null);

    // Restore focus and put the cursor right after the inserted mention so
    // the person can keep typing without having to click back in.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const pos = before.length + inserted.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const pickDocTag = (doc: { title: string }) => {
    if (!docTag) return;
    const cursor = textareaRef.current?.selectionStart ?? draft.length;
    const before = draft.slice(0, docTag.start);
    const after = draft.slice(cursor);
    const inserted = `#${doc.title} `;
    const newValue = `${before}${inserted}${after}`;
    setDraft(newValue);
    setDocTag(null);

    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const pos = before.length + inserted.length;
      el.setSelectionRange(pos, pos);
    });
  };

  // Plain insertion at the current cursor position — unlike pickMention/
  // pickDocTag this isn't replacing a "@query"/"#query" trigger, just
  // dropping the emoji in wherever the cursor currently is.
  const insertEmoji = (emoji: string) => {
    const cursor = textareaRef.current?.selectionStart ?? draft.length;
    const before = draft.slice(0, cursor);
    const after = draft.slice(cursor);
    const newValue = `${before}${emoji}${after}`;
    setDraft(newValue);
    setShowEmojiPicker(false);

    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const pos = before.length + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleSend = async () => {
    if (!activeTeamId || sending) return;
    if (!draft.trim() && !pendingFile) return;
    setShowEmojiPicker(false);
    const senderProfile = emailToProfile.get(currentUserEmail.toLowerCase());
    const teamLabel = activeTeam?.name || 'Team Chat';
    const draftAtSend = draft;
    const wasAnnouncement = draftIsAnnouncement;
    const toNotify = [...mentionedProfiles.values()];
    setSending(true);
    setSendError('');
    try {
      await hrActions.sendMessage(
        activeTeamId,
        currentUserEmail,
        senderProfile?.fullName || currentUserEmail,
        draftAtSend,
        pendingFile || undefined,
        wasAnnouncement
      );
      setDraft('');
      setPendingFile(null);
      setMentionedProfiles(new Map());
      setMention(null);
      setDocTag(null);
      setDraftIsAnnouncement(false);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Best-effort: a failed mention notification shouldn't make the
      // message itself look like it failed to send. Each recipient sees
      // the sender's name exactly as they're normally allowed to (their
      // own role decides real name vs. Alias) — not a fixed name for
      // everyone.
      toNotify.forEach(p => {
        if (p.email.toLowerCase() === currentUserEmail.toLowerCase()) return;
        const senderLabelForRecipient = senderProfile ? displayName(senderProfile, p.role) : currentUserEmail;
        hrActions
          .addNotification(p.email, p.role, `${senderLabelForRecipient} mentioned you in ${teamLabel} chat.`)
          .catch(err => console.error('Mention notification failed:', err));
      });
    } catch (err) {
      console.error('Send message failed:', err);
      setSendError('Could not send that message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
        <ShieldCheck className="h-10 w-10 opacity-30" />
        <p className="font-semibold text-sm">{oversight ? 'No teams exist yet.' : "You're not assigned to a team yet."}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-2 md:gap-4 flex-1 h-full min-h-0">
      {/* Team selector — only shown when there's more than one team to pick from */}
      {teams.length > 1 && (
        <div className="md:w-56 shrink-0 flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-1 md:pb-0 scrollbar-hide px-1 md:px-0">
          {teams.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTeamId(t.id)}
              className={`px-4 py-2 md:py-2.5 rounded-full md:rounded-xl text-xs font-bold text-left whitespace-nowrap md:whitespace-normal transition-all shrink-0 ${
                activeTeamId === t.id ? 'bg-orange-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.name}
              {oversight && <span className={`block text-[9px] font-semibold mt-0.5 ${activeTeamId === t.id ? 'text-orange-100' : 'text-slate-400'}`}>{t.members.length} members</span>}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-xl md:rounded-2xl overflow-hidden min-h-0">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/60 hidden md:flex items-center justify-between shrink-0 gap-2">
          <h3 className="font-bold text-slate-900 text-sm truncate">
            {activeTeam?.name || 'Team Chat'}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {oversight && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">Viewing every channel</span>}
            {/* Chat / Team Documents tab toggle */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 mr-1">
              <button
                onClick={() => setActivePanel('chat')}
                className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md transition-all ${
                  activePanel === 'chat' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <MessageCircle className="h-3 w-3" /> Chat
              </button>
              <button
                onClick={() => setActivePanel('documents')}
                className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md transition-all ${
                  activePanel === 'documents' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <FolderOpen className="h-3 w-3" /> Documents{teamDocuments.length > 0 ? ` (${teamDocuments.length})` : ''}
              </button>
            </div>
            {activePanel === 'chat' && announcements.length > 0 && (
              <button
                onClick={() => setShowAnnouncements(v => !v)}
                className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-lg transition-all ${
                  showAnnouncements ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <Megaphone className="h-3 w-3" /> {announcements.length}
              </button>
            )}
            {activePanel === 'chat' && (
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-lg transition-all ${
                  showFilters || hasActiveFilters ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <SlidersHorizontal className="h-3 w-3" /> {hasActiveFilters ? `Filtered (${filteredMessages.length})` : 'Filter'}
              </button>
            )}
          </div>
        </div>

        {activePanel === 'documents' && (
          <TeamDocumentsPanel
            team={activeTeam || null}
            currentUserEmail={currentUserEmail}
            currentUserRole={currentUserRole}
            currentUserName={emailToProfile.get(currentUserEmail.toLowerCase())?.fullName || currentUserEmail}
            canManage={canManageDocuments}
          />
        )}

        {/* Pinned Announcements */}
        {activePanel === 'chat' && showAnnouncements && announcements.length > 0 && (
          <div className="border-b border-amber-200 bg-amber-50/60 max-h-40 overflow-y-auto shrink-0">
            {announcements.slice().reverse().map(a => (
              <div key={a.id} className="px-4 py-2 border-b border-amber-100 last:border-b-0 text-xs">
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-amber-700 uppercase tracking-wider">
                  <Megaphone className="h-2.5 w-2.5" /> {senderLabel(a)} · {formatTimestamp(a.timestamp)}
                </div>
                {a.text && <p className="text-slate-700 font-medium mt-0.5">{a.text}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Search & Filter panel */}
        {activePanel === 'chat' && showFilters && (
          <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 shrink-0 space-y-2.5">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search messages, senders, or file names…"
                className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-8 pr-3 text-xs outline-none focus:border-orange-500 font-medium"
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-white border border-slate-200 rounded-lg py-1.5 px-2 text-[10px] font-semibold outline-none focus:border-orange-500" />
              <span className="text-[10px] text-slate-400 font-bold">to</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-white border border-slate-200 rounded-lg py-1.5 px-2 text-[10px] font-semibold outline-none focus:border-orange-500" />

              <select value={fileTypeFilter} onChange={e => setFileTypeFilter(e.target.value as FileTypeFilter)} className="bg-white border border-slate-200 rounded-lg py-1.5 px-2 text-[10px] font-bold outline-none focus:border-orange-500">
                <option value="all">All types</option>
                <option value="image">Images</option>
                <option value="document">Documents</option>
                <option value="other">Other files</option>
                <option value="none">Text only</option>
                <option value="announcement">Announcements</option>
              </select>

              <select value={sizeFilter} onChange={e => setSizeFilter(e.target.value as SizeFilter)} className="bg-white border border-slate-200 rounded-lg py-1.5 px-2 text-[10px] font-bold outline-none focus:border-orange-500">
                <option value="all">Any size</option>
                <option value="small">Small (&lt;1MB)</option>
                <option value="medium">Medium (1–5MB)</option>
                <option value="large">Large (&gt;5MB)</option>
              </select>

              {hasActiveFilters && (
                <button
                  onClick={() => { setSearchQuery(''); setDateFrom(''); setDateTo(''); setFileTypeFilter('all'); setSizeFilter('all'); }}
                  className="flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:text-rose-700 ml-auto"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
          </div>
        )}

        {activePanel === 'chat' && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
          {isLoading && <p className="text-xs text-slate-400 text-center font-semibold py-6">Loading messages…</p>}
          {!isLoading && messages.length === 0 && (
            <p className="text-xs text-slate-400 text-center font-semibold py-6 italic">No messages yet — say hi 👋</p>
          )}
          {!isLoading && messages.length > 0 && filteredMessages.length === 0 && (
            <p className="text-xs text-slate-400 text-center font-semibold py-6 italic">No messages match your search/filters.</p>
          )}
          {filteredMessages.map(m => {
            const isSelf = m.senderEmail.toLowerCase() === currentUserEmail.toLowerCase();
            const label = senderLabel(m);
            // Admin is auto-a-member of every team channel and can post
            // anywhere — their messages get a distinct highlighted look
            // (purple + crown badge) in every viewer's chat, self or not,
            // so they're unmistakable next to regular team messages.
            const isAdminSender = emailToProfile.get(m.senderEmail.toLowerCase())?.role === 'admin';

            // Announcements render full-width and pinned-banner styled,
            // not as a left/right chat bubble — they're meant to stand out
            // from the regular back-and-forth, not blend into it.
            if (m.isAnnouncement) {
              return (
                <div key={m.id} className="border-2 border-amber-300 bg-amber-50 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-700 uppercase tracking-wider mb-1">
                    <Megaphone className="h-3.5 w-3.5" /> Announcement · {label}
                    {isAdminSender && <Crown className="h-3 w-3 text-purple-600" />}
                    <span className="text-slate-400 font-semibold normal-case ml-auto">{formatTimestamp(m.timestamp)}</span>
                  </div>
                  {m.text && (
                    <p className="text-xs font-semibold text-slate-800 whitespace-pre-wrap break-words">
                      {renderMessageText(m.text, mentionLabels, docTagList, false)}
                    </p>
                  )}
                  {m.attachmentUrl && (
                    isImageAttachment(m.attachmentName) ? (
                      <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className={m.text ? 'block mt-2' : 'block'}>
                        <img src={m.attachmentUrl} alt={m.attachmentName || 'attachment'} className="rounded-lg max-h-56 object-cover" />
                      </a>
                    ) : (
                      <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className={`flex items-center gap-1.5 text-[11px] font-bold underline text-amber-700 ${m.text ? 'mt-2' : ''}`}>
                        <FileText className="h-3.5 w-3.5 shrink-0" /> {m.attachmentName || 'Attachment'} <Download className="h-3 w-3 shrink-0" />
                      </a>
                    )
                  )}
                </div>
              );
            }

            return (
              <div key={m.id} className={`flex gap-2 ${isSelf ? 'flex-row-reverse' : ''}`}>
                <Avatar src={emailToProfile.get(m.senderEmail.toLowerCase())?.profilePicture} name={label} size={28} />
                <div className={`max-w-[75%] flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[10px] font-bold ${isAdminSender ? 'text-purple-700' : 'text-slate-600'}`}>{label}</span>
                    {isAdminSender && (
                      <span className="flex items-center gap-0.5 bg-purple-100 text-purple-700 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full">
                        <Crown className="h-2.5 w-2.5" /> Admin
                      </span>
                    )}
                    <span className="text-[9px] text-slate-400 font-semibold">{formatTimestamp(m.timestamp)}</span>
                  </div>
                  <div className={`rounded-2xl px-3.5 py-2.5 text-xs font-medium leading-relaxed ${
                    isAdminSender
                      ? 'bg-purple-600 text-white ring-2 ring-purple-200 ' + (isSelf ? 'rounded-tr-sm' : 'rounded-tl-sm')
                      : isSelf ? 'bg-orange-600 text-white rounded-tr-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                  }`}>
                    {m.text && (
                      <p className="whitespace-pre-wrap break-words">
                        {renderMessageText(m.text, mentionLabels, docTagList, isAdminSender || isSelf)}
                      </p>
                    )}
                    {m.attachmentUrl && (
                      isImageAttachment(m.attachmentName) ? (
                        <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className={m.text ? 'block mt-2' : 'block'}>
                          <img src={m.attachmentUrl} alt={m.attachmentName || 'attachment'} className="rounded-lg max-h-56 object-cover" />
                        </a>
                      ) : (
                        <a
                          href={m.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`flex items-center gap-1.5 text-[11px] font-bold underline ${m.text ? 'mt-2' : ''} ${isAdminSender || isSelf ? 'text-white' : 'text-orange-700'}`}
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0" /> {m.attachmentName || 'Attachment'}
                          {m.attachmentSize !== undefined && <span className="font-semibold opacity-80">({formatBytes(m.attachmentSize)})</span>}
                          <Download className="h-3 w-3 shrink-0" />
                        </a>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}

        {activePanel === 'chat' && (
          <div className="border-t border-slate-200 p-3 pb-safe shrink-0 relative bg-white md:bg-transparent">
            {oversight && (
              <p className="text-[9px] text-purple-600 font-bold mb-2 flex items-center gap-1"><Crown className="h-3 w-3" /> Posting as Admin — this message will be highlighted for everyone in {activeTeam?.name || 'this team'}.</p>
            )}
            {draftIsAnnouncement && (
              <p className="text-[9px] text-amber-700 font-bold mb-2 flex items-center gap-1"><Megaphone className="h-3 w-3" /> Sending as a pinned Announcement — everyone in {activeTeam?.name || 'this team'} will see it highlighted at the top.</p>
            )}
            {sendError && <p className="text-[10px] text-rose-600 font-bold mb-1.5 px-1">{sendError}</p>}
            {pendingFile && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 mb-2 text-[10px] font-bold text-slate-600">
                <Paperclip className="h-3 w-3" /> {pendingFile.name}
                <button onClick={() => { setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="ml-auto text-slate-400 hover:text-rose-600">✕</button>
              </div>
            )}

            {/* @mention suggestion dropdown */}
            {mention && mentionSuggestions.length > 0 && (
              <div className="absolute bottom-full left-3 mb-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10">
                {mentionSuggestions.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); pickMention(p); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-orange-50 transition-colors"
                  >
                    <Avatar src={p.profilePicture} name={displayName(p, currentUserRole)} size={22} />
                    <span className="text-xs font-bold text-slate-800 truncate">{displayName(p, currentUserRole)}</span>
                    {p.role === 'admin' && <Crown className="h-3 w-3 text-purple-600 ml-auto shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            {/* "#" document-tag suggestion dropdown */}
            {docTag && docTagSuggestions.length > 0 && (
              <div className="absolute bottom-full left-3 mb-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10">
                {docTagSuggestions.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); pickDocTag(d); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-sky-50 transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 truncate">{d.title}</span>
                  </button>
                ))}
              </div>
            )}
            {docTag && docTagSuggestions.length === 0 && teamDocuments.length === 0 && (
              <div className="absolute bottom-full left-3 mb-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10 px-3 py-2">
                <span className="text-[10px] text-slate-400 font-semibold">No documents in this team yet.</span>
              </div>
            )}

            <div className="flex items-end gap-2">
              <label className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 cursor-pointer transition-all shrink-0">
                <Paperclip className="h-4 w-4" />
                <input ref={fileInputRef} type="file" className="hidden" onChange={e => handleFilePick(e.target.files?.[0])} />
              </label>
              <button
                type="button"
                onClick={() => setDraftIsAnnouncement(v => !v)}
                title="Send as Announcement"
                className={`p-2.5 rounded-xl transition-all shrink-0 ${
                  draftIsAnnouncement ? 'bg-amber-500 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
                }`}
              >
                <Megaphone className="h-4 w-4" />
              </button>
              <div ref={emojiWrapperRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(v => !v)}
                  title="Insert emoji"
                  className={`p-2.5 rounded-xl transition-all ${
                    showEmojiPicker ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
                  }`}
                >
                  <Smile className="h-4 w-4" />
                </button>
                {showEmojiPicker && (
                  <EmojiPicker onPick={insertEmoji} onClose={() => setShowEmojiPicker(false)} />
                )}
              </div>
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={handleDraftChange}
                onKeyDown={e => {
                  if (mention && mentionSuggestions.length > 0 && (e.key === 'Enter' || e.key === 'Tab')) {
                    e.preventDefault();
                    pickMention(mentionSuggestions[0]);
                    return;
                  }
                  if (mention && e.key === 'Escape') {
                    e.preventDefault();
                    setMention(null);
                    return;
                  }
                  if (docTag && docTagSuggestions.length > 0 && (e.key === 'Enter' || e.key === 'Tab')) {
                    e.preventDefault();
                    pickDocTag(docTagSuggestions[0]);
                    return;
                  }
                  if (docTag && e.key === 'Escape') {
                    e.preventDefault();
                    setDocTag(null);
                    return;
                  }
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={draftIsAnnouncement ? 'Write your announcement…' : 'Message your team… (@ to mention, # to tag a document)'}
                rows={1}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs outline-none focus:border-orange-500 font-medium resize-none max-h-24"
              />
              <button
                onClick={handleSend}
                disabled={sending || (!draft.trim() && !pendingFile)}
                className={`p-2.5 rounded-xl disabled:opacity-50 text-white transition-all active:scale-95 shrink-0 ${
                  draftIsAnnouncement ? 'bg-amber-500 hover:bg-amber-600' : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
