import { useEffect, useState } from 'react';
import type { AssetKind, MediaAssetSummary, PublicSettings } from '../../shared/contracts';

type Page = 'Library' | 'Pattern Analysis' | 'Create' | 'Review & Export' | 'Settings';

const pageDescriptions: Record<Page, string> = {
  Library: 'Keep owned/licensed production assets completely separate from references.',
  'Pattern Analysis': 'Extract reusable creative structure, never source wording or visuals.',
  Create: 'Turn approved evidence and a Pattern Card into an original China-travel storyboard.',
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
    } finally { setLoading(false); }
  };
  return <section className="page-grid">
    <div className="toolbar"><div className="tabs">{(['owned', 'reference'] as const).map((kind) => <button className={assetKind === kind ? 'tab active' : 'tab'} onClick={() => setAssetKind(kind)} key={kind}>{kind === 'owned' ? 'Owned assets' : 'References'}</button>)}</div><button className="primary" disabled={loading} onClick={() => void importAssets()}>{loading ? 'Hashing files…' : `Import ${assetKind === 'owned' ? 'owned media' : 'reference'}`}</button></div>
    <div className="notice">{assetKind === 'owned' ? 'Only owned or explicitly licensed assets can be selected for final rendering.' : 'Reference items are analysis-only and are excluded from all final renders.'}</div>
    <div className="asset-grid">{assets.length === 0 ? <div className="empty">Import a file to begin. Media Lab indexes it in place and never alters the original.</div> : assets.map((asset) => <article className="asset" key={asset.id}><div className="asset-poster">{asset.name.split('.').pop()?.toUpperCase()}</div><div><strong>{asset.name}</strong><p>{asset.rightsStatus} · {asset.contentHash.slice(0, 12)}</p></div></article>)}</div>
  </section>;
}

function PatternAnalysis(): JSX.Element { return <section className="split"><div className="preview-panel"><span className="eyebrow">REFERENCE ITEM</span><h2>Analyze a reference safely</h2><p>Import a video, screenshot, image, text, or URL metadata from Library. Media Lab extracts abstract hook, pacing, caption and CTA patterns.</p><div className="video-placeholder">Reference preview</div></div><div className="card"><span className="eyebrow">PATTERN CARD</span><h2>Originality requirements</h2><ul><li>Replace source wording, examples and visual assets.</li><li>Use only approved VisePanda evidence for factual claims.</li><li>Match every beat to owned/licensed media.</li></ul><button className="primary">Create from Pattern Card</button></div></section>; }
function Create(): JSX.Element { return <section className="create-layout"><div className="card"><span className="eyebrow">CREATIVE BRIEF</span><h2>Build an execution-first story</h2><label>Topic<input placeholder="e.g. Payment setup before landing" /></label><div className="form-row"><label>Platform<select><option>TikTok</option><option>Instagram Reels</option><option>Facebook</option><option>Reddit</option></select></label><label>Language<select><option>English</option><option>Chinese</option></select></label></div><button className="primary">Generate original angles</button></div><div className="card"><span className="eyebrow">STORYBOARD</span><h2>Waiting for a Pattern Card</h2><p>When AI is configured, this panel will show evidence-aware beats, draft copy, timing and owned-asset candidates.</p></div></section>; }
function ReviewExport(): JSX.Element { return <section className="review-layout"><div className="video-placeholder tall">Vertical preview · 9:16</div><div className="card"><span className="eyebrow">REVIEW GATE</span><h2>Export only after review</h2><div className="check">□ Every selected asset has current rights.</div><div className="check">□ Travel facts are supported by approved evidence.</div><div className="check">□ Reference content is not used in the render.</div><button className="primary" disabled>Export bundle</button></div></section>; }
function Settings(): JSX.Element { const [settings, setSettings] = useState<PublicSettings | null>(null); const [key, setKey] = useState(''); const refresh = async () => setSettings(await window.vpMedia.settings.get()); useEffect(() => { void refresh(); }, []); return <section className="settings"><div className="card"><span className="eyebrow">LOCAL LIBRARY</span><h2>{settings?.libraryPath ?? 'No library folder selected'}</h2><button className="secondary" onClick={() => void window.vpMedia.settings.chooseLibrary().then(refresh)}>Choose library folder</button></div><div className="card"><span className="eyebrow">AI PROVIDER</span><h2>{settings?.aiKeyConfigured ? 'API key configured' : 'API key not configured'}</h2><p>Keys stay encrypted in Windows storage. They are never shown, exported or written to project files.</p><div className="key-row"><input type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder="Enter a newly generated Model Studio key" /><button className="primary" onClick={() => void window.vpMedia.settings.saveApiKey({ value: key }).then(() => { setKey(''); return refresh(); })}>Save locally</button></div></div></section>; }

export function App(): JSX.Element {
  const [page, setPage] = useState<Page>('Library');
  return <main className="shell"><aside><div className="brand"><span>VP</span><div>Media Lab<small>VisePanda internal studio</small></div></div><nav>{(Object.keys(pageDescriptions) as Page[]).map((item) => <button key={item} onClick={() => setPage(item)} className={page === item ? 'nav-item selected' : 'nav-item'}>{item}</button>)}</nav><div className="aside-footer">Local files · Human review · Manual publishing</div></aside><div className="workspace"><header><div><span className="eyebrow">VP MEDIA LAB</span><h1>{page}</h1><p>{pageDescriptions[page]}</p></div><div className="status"><i /> Local workspace</div></header>{page === 'Library' && <Library />}{page === 'Pattern Analysis' && <PatternAnalysis />}{page === 'Create' && <Create />}{page === 'Review & Export' && <ReviewExport />}{page === 'Settings' && <Settings />}</div></main>;
}
