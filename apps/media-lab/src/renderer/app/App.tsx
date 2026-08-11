import { useEffect, useState } from 'react';
import type { AssetKind, MediaAssetSummary, PendingEditProposalView, ProjectStoryboard, ProjectSummary, PublicSettings } from '../../shared/contracts';
import { describeEditProposal } from './edit-proposal-view';

type Page = 'Library' | 'Pattern Analysis' | 'Create' | 'Review & Export' | 'Settings';

const pageDescriptions: Record<Page, string> = {
  Library: 'Keep owned/licensed production assets completely separate from references.',
  'Pattern Analysis': 'Extract reusable creative structure, never source wording or visuals.',
  Create: 'Start a local draft before using AI to propose an original storyboard.',
  'Review & Export': 'Correct the automated cut, review rights, then export a transparent bundle.',
  Settings: 'Local-only configuration. API keys are encrypted in Windows storage and never displayed.'
};

function Library(): JSX.Element {
  const [assetKind, setAssetKind] = useState<AssetKind>('owned');
  const [assets, setAssets] = useState<MediaAssetSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const reload = async () => setAssets(await window.vpMedia.assets.list({ assetKind }));
  useEffect(() => { void reload(); }, [assetKind]);
  const importAssets = async () => {
    setLoading(true);
    try {
      const paths = await window.vpMedia.assets.chooseFiles();
      if (paths.length > 0) await window.vpMedia.assets.import({ paths, assetKind });
      await reload();
    } finally {
      setLoading(false);
    }
  };
  return <section className="page-grid">
    <div className="toolbar">
      <div className="tabs">{(['owned', 'reference'] as const).map((kind) => <button className={assetKind === kind ? 'tab active' : 'tab'} onClick={() => setAssetKind(kind)} key={kind}>{kind === 'owned' ? 'Owned assets' : 'References'}</button>)}</div>
      <button className="primary" disabled={loading} onClick={() => void importAssets()}>{loading ? 'Hashing files...' : `Import ${assetKind === 'owned' ? 'owned media' : 'reference'}`}</button>
    </div>
    <div className="notice">{assetKind === 'owned' ? 'Only owned or explicitly licensed assets can be selected for final rendering.' : 'Reference items are analysis-only and are excluded from all final renders.'}</div>
    <div className="asset-grid">{assets.length === 0 ? <div className="empty">Import a file to begin. Media Lab indexes it in place and never alters the original.</div> : assets.map((asset) => <article className="asset" key={asset.id}><div className="asset-poster">{asset.name.split('.').pop()?.toUpperCase()}</div><div><strong>{asset.name}</strong><p>{asset.rightsStatus} | {asset.contentHash.slice(0, 12)}</p></div></article>)}</div>
  </section>;
}

function PatternAnalysis(): JSX.Element {
  return <section className="split"><div className="preview-panel"><span className="eyebrow">REFERENCE ITEM</span><h2>Analyze a reference safely</h2><p>Import a video, screenshot, image, text, or URL metadata from Library. Media Lab extracts abstract hook, pacing, caption and CTA patterns.</p><div className="video-placeholder">Reference preview</div></div><div className="card"><span className="eyebrow">PATTERN CARD</span><h2>Originality requirements</h2><ul><li>Replace source wording, examples and visual assets.</li><li>Use only approved VisePanda evidence for factual claims.</li><li>Match every beat to owned/licensed media.</li></ul><button className="primary" disabled>Create from Pattern Card</button></div></section>;
}

function Create(): JSX.Element {
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<'en' | 'zh' | 'other'>('en');
  const [created, setCreated] = useState<ProjectSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const create = async () => {
    setCreating(true);
    try {
      setCreated(await window.vpMedia.projects.create({ title, language }));
      setTitle('');
    } finally {
      setCreating(false);
    }
  };
  return <section className="create-layout"><div className="card"><span className="eyebrow">CREATIVE BRIEF</span><h2>Start an execution-first story</h2><label>Topic<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Payment setup before landing" /></label><div className="form-row"><label>Platform<select disabled><option>TikTok</option></select></label><label>Language<select value={language} onChange={(event) => setLanguage(event.target.value as 'en' | 'zh' | 'other')}><option value="en">English</option><option value="zh">Chinese</option><option value="other">Other</option></select></label></div><button className="primary" disabled={creating || title.trim().length < 3} onClick={() => void create()}>{creating ? 'Creating local draft...' : 'Create local draft'}</button></div><div className="card"><span className="eyebrow">STORYBOARD</span><h2>{created ? 'Draft ready for Review' : 'No draft selected'}</h2><p>{created ? `“${created.title}” has one editable opening beat. Use Review & Export to refine it with the Copilot.` : 'Pattern-based AI creation is the next stage. A local draft never fabricates travel facts or asset matches.'}</p></div></section>;
}

function ReviewExport(): JSX.Element {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [active, setActive] = useState<ProjectStoryboard | null>(null);
  const [message, setMessage] = useState('');
  const [proposal, setProposal] = useState<PendingEditProposalView | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  useEffect(() => { void window.vpMedia.projects.list().then(setProjects); }, []);
  const selectProject = async (id: string) => {
    if (proposal) {
      setDiscarding(true);
      try {
        await window.vpMedia.chat.discard({
          projectId: proposal.proposal.projectId,
          proposalId: proposal.proposal.id,
          expectedRevision: proposal.baseRevision
        });
      } catch (error) {
        setChatError(error instanceof Error ? error.message : 'Unable to discard the current proposal before switching projects.');
        return;
      } finally {
        setDiscarding(false);
      }
    }
    if (!id) {
      setActive(null);
      setProposal(null);
      return;
    }
    setActive(await window.vpMedia.projects.get({ id }));
    setProposal(null);
    setChatError(null);
    setConfirmation(null);
  };
  const propose = async () => {
    if (!active) return;
    setProposing(true);
    setChatError(null);
    setConfirmation(null);
    try {
      setProposal(await window.vpMedia.chat.propose({ projectId: active.id, message }));
      setMessage('');
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Unable to request an editing proposal.');
    } finally {
      setProposing(false);
    }
  };
  const confirm = async () => {
    if (!proposal) return;
    setConfirming(true);
    setChatError(null);
    try {
      setActive(await window.vpMedia.chat.confirm({
        projectId: proposal.proposal.projectId,
        proposalId: proposal.proposal.id,
        expectedRevision: proposal.baseRevision
      }));
      setProposal(null);
      setConfirmation('The reviewed proposal was applied as a new local revision.');
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Unable to confirm this editing proposal.');
    } finally {
      setConfirming(false);
    }
  };
  const discard = async () => {
    if (!proposal) return;
    setDiscarding(true);
    setChatError(null);
    try {
      await window.vpMedia.chat.discard({
        projectId: proposal.proposal.projectId,
        proposalId: proposal.proposal.id,
        expectedRevision: proposal.baseRevision
      });
      setProposal(null);
      setConfirmation('The proposal was discarded and can no longer be confirmed.');
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Unable to discard this editing proposal.');
    } finally {
      setDiscarding(false);
    }
  };
  return <section className="review-layout">
    <div className="video-placeholder tall">Vertical preview | 9:16</div>
    <div className="card">
      <span className="eyebrow">EDITING DRAFT</span>
      <h2>{active?.title ?? 'Choose a local draft'}</h2>
      {projects.length === 0 ? <p>Create a local draft in Create before reviewing or asking the Copilot to propose edits.</p> : <select value={active?.id ?? ''} onChange={(event) => void selectProject(event.target.value)}><option value="">Select draft</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select>}
      {active && <p>{active.storyboard.beats.length} beat(s) | {active.storyboard.language.toUpperCase()} | edits remain drafts until confirmed.</p>}
      <span className="eyebrow">EDITING COPILOT</span>
      {active && <><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Describe one change, e.g. make the first caption shorter" rows={3} /><button className="secondary" disabled={proposing || discarding || proposal !== null || message.trim().length === 0} onClick={() => void propose()}>{proposing ? 'Preparing proposal...' : proposal ? 'Resolve current proposal first' : 'Propose edit'}</button></>}
      {proposal && <div className="notice"><strong>Review before applying:</strong> {proposal.proposal.summary}<ul>{describeEditProposal(proposal.proposal).map((detail) => <li key={detail}>{detail}</li>)}</ul>This exact main-process proposal changes only the local draft after confirmation.<div className="form-row"><button className="primary" disabled={confirming || discarding || active?.revision !== proposal.baseRevision} onClick={() => void confirm()}>{confirming ? 'Applying revision...' : 'Confirm exact changes'}</button><button className="secondary" disabled={confirming || discarding} onClick={() => void discard()}>{discarding ? 'Discarding...' : 'Discard proposal'}</button></div></div>}
      {confirmation && <div className="notice">{confirmation}</div>}
      {chatError && <div className="notice">Copilot unavailable: {chatError === 'AI_NOT_CONFIGURED' ? 'configure an eligible Model Studio service key in Settings.' : chatError}</div>}
      <span className="eyebrow">REVIEW GATE</span><div className="check">Every selected asset has current rights.</div><div className="check">Travel facts are supported by approved evidence.</div><div className="check">Reference content is not used in the render.</div><button className="primary" disabled>Export bundle</button>
    </div>
  </section>;
}

function Settings(): JSX.Element {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [key, setKey] = useState('');
  const refresh = async () => setSettings(await window.vpMedia.settings.get());
  useEffect(() => { void refresh(); }, []);
  return <section className="settings"><div className="card"><span className="eyebrow">LOCAL LIBRARY</span><h2>{settings?.libraryPath ?? 'No library folder selected'}</h2><button className="secondary" onClick={() => void window.vpMedia.settings.chooseLibrary().then(refresh)}>Choose library folder</button></div><div className="card"><span className="eyebrow">AI PROVIDER</span><h2>{settings?.aiKeyConfigured ? 'API key configured' : 'API key not configured'}</h2><p>Use an eligible Model Studio model-service key. Token Plan keys are not used by this desktop application. Keys stay encrypted in Windows storage and are never shown, exported or written to project files.</p><div className="key-row"><input type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder="Enter a newly generated Model Studio key" /><button className="primary" onClick={() => void window.vpMedia.settings.saveApiKey({ value: key }).then(() => { setKey(''); return refresh(); })}>Save locally</button></div></div></section>;
}

export function App(): JSX.Element {
  const [page, setPage] = useState<Page>('Library');
  return <main className="shell"><aside><div className="brand"><span>VP</span><div>Media Lab<small>VisePanda internal studio</small></div></div><nav>{(Object.keys(pageDescriptions) as Page[]).map((item) => <button key={item} onClick={() => setPage(item)} className={page === item ? 'nav-item selected' : 'nav-item'}>{item}</button>)}</nav><div className="aside-footer">Local files | Human review | Manual publishing</div></aside><div className="workspace"><header><div><span className="eyebrow">VP MEDIA LAB</span><h1>{page}</h1><p>{pageDescriptions[page]}</p></div><div className="status"><i /> Local workspace</div></header>{page === 'Library' && <Library />}{page === 'Pattern Analysis' && <PatternAnalysis />}{page === 'Create' && <Create />}{page === 'Review & Export' && <ReviewExport />}{page === 'Settings' && <Settings />}</div></main>;
}
