import { useEffect, useState } from 'react';
import type { AssetKind, MediaAssetSummary, PendingEditProposalView, ProjectStoryboard, ProjectSummary, ProviderConnectionTestResult, PublicSettings } from '../../shared/contracts';
import { describeEditProposal } from './edit-proposal-view';

type Page = 'Library' | 'Pattern Analysis' | 'Create' | 'Review & Export' | 'Settings';

const pageLabels: Record<Page, string> = {
  Library: '素材库',
  'Pattern Analysis': '模式分析',
  Create: '创作',
  'Review & Export': '审核与导出',
  Settings: '设置'
};

const pageDescriptions: Record<Page, string> = {
  Library: '将自有或已授权的制作素材与参考素材严格分开。',
  'Pattern Analysis': '提炼可复用的创作结构，绝不复用原始文案或画面。',
  Create: '先创建本地草稿，再让 AI 提出原创分镜建议。',
  'Review & Export': '审核自动剪辑建议与授权信息，再导出透明的交付包。',
  Settings: '仅限本地的配置。API 密钥由 Windows 加密保存，永不显示。'
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
      <div className="tabs">{(['owned', 'reference'] as const).map((kind) => <button className={assetKind === kind ? 'tab active' : 'tab'} onClick={() => setAssetKind(kind)} key={kind}>{kind === 'owned' ? '自有素材' : '参考素材'}</button>)}</div>
      <button className="primary" disabled={loading} onClick={() => void importAssets()}>{loading ? '正在计算文件哈希…' : `导入${assetKind === 'owned' ? '自有素材' : '参考素材'}`}</button>
    </div>
    <div className="notice">{assetKind === 'owned' ? '只有自有或明确获得授权的素材，才能进入最终成片。' : '参考素材仅用于分析，绝不会进入最终成片。'}</div>
    <div className="asset-grid">{assets.length === 0 ? <div className="empty">导入一个文件即可开始。Media Lab 只建立索引，绝不修改原始文件。</div> : assets.map((asset) => <article className="asset" key={asset.id}><div className="asset-poster">{asset.name.split('.').pop()?.toUpperCase()}</div><div><strong>{asset.name}</strong><p>{asset.rightsStatus} | {asset.contentHash.slice(0, 12)}</p></div></article>)}</div>
  </section>;
}

function PatternAnalysis(): JSX.Element {
  return <section className="split"><div className="preview-panel"><span className="eyebrow">参考内容</span><h2>安全拆解参考素材</h2><p>在素材库导入视频、截图、图片、文字或链接元数据。Media Lab 只提取抽象的钩子、节奏、字幕和 CTA 模式。</p><div className="video-placeholder">参考素材预览</div></div><div className="card"><span className="eyebrow">模式卡</span><h2>原创性要求</h2><ul><li>替换原内容的措辞、案例和视觉素材。</li><li>旅行事实只能使用经过审核的 VisePanda 证据。</li><li>每个节拍都必须匹配自有或已授权素材。</li></ul><button className="primary" disabled>从模式卡开始创作</button></div></section>;
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
  return <section className="create-layout"><div className="card"><span className="eyebrow">创作简报</span><h2>从可执行的旅行故事开始</h2><label>主题<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：落地前的支付准备" /></label><div className="form-row"><label>平台<select disabled><option>TikTok</option></select></label><label>语言<select value={language} onChange={(event) => setLanguage(event.target.value as 'en' | 'zh' | 'other')}><option value="en">英文</option><option value="zh">中文</option><option value="other">其他语言</option></select></label></div><button className="primary" disabled={creating || title.trim().length < 3} onClick={() => void create()}>{creating ? '正在创建本地草稿…' : '创建本地草稿'}</button></div><div className="card"><span className="eyebrow">分镜</span><h2>{created ? '草稿已可供审核' : '尚未选择草稿'}</h2><p>{created ? `“${created.title}”已创建一个可编辑的开场节拍。请在「审核与导出」中使用剪辑助手继续完善。` : '基于模式的 AI 创作将在下一阶段提供。本地草稿不会虚构旅行事实或素材匹配。'}</p></div></section>;
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
        setChatError(error instanceof Error ? error.message : '切换草稿前无法丢弃当前建议。');
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
      setChatError(error instanceof Error ? error.message : '无法请求剪辑建议。');
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
      setConfirmation('已将审核过的建议应用为新的本地版本。');
    } catch (error) {
      setChatError(error instanceof Error ? error.message : '无法确认这条剪辑建议。');
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
      setConfirmation('这条建议已丢弃，不能再被确认。');
    } catch (error) {
      setChatError(error instanceof Error ? error.message : '无法丢弃这条剪辑建议。');
    } finally {
      setDiscarding(false);
    }
  };
  return <section className="review-layout">
    <div className="video-placeholder tall">竖屏预览 | 9:16</div>
    <div className="card">
      <span className="eyebrow">剪辑草稿</span>
      <h2>{active?.title ?? '请选择本地草稿'}</h2>
      {projects.length === 0 ? <p>请先在「创作」中建立本地草稿，再审核或请求剪辑助手提出建议。</p> : <select value={active?.id ?? ''} onChange={(event) => void selectProject(event.target.value)}><option value="">选择草稿</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select>}
      {active && <p>{active.storyboard.beats.length} 个节拍 | {active.storyboard.language.toUpperCase()} | 所有修改均需确认后才会生效。</p>}
      <span className="eyebrow">剪辑助手</span>
      {active && <><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="描述一个修改，例如：将第一条字幕缩短" rows={3} /><button className="secondary" disabled={proposing || discarding || proposal !== null || message.trim().length === 0} onClick={() => void propose()}>{proposing ? '正在准备建议…' : proposal ? '请先处理当前建议' : '提出剪辑建议'}</button></>}
      {proposal && <div className="notice"><strong>应用前请审核：</strong> {proposal.proposal.summary}<ul>{describeEditProposal(proposal.proposal).map((detail) => <li key={detail}>{detail}</li>)}</ul>只有确认后，这份来自主进程的精确建议才会修改本地草稿。<div className="form-row"><button className="primary" disabled={confirming || discarding || active?.revision !== proposal.baseRevision} onClick={() => void confirm()}>{confirming ? '正在应用新版本…' : '确认以上修改'}</button><button className="secondary" disabled={confirming || discarding} onClick={() => void discard()}>{discarding ? '正在丢弃…' : '丢弃建议'}</button></div></div>}
      {confirmation && <div className="notice">{confirmation}</div>}
      {chatError && <div className="notice">剪辑助手暂不可用：{chatError === 'AI_NOT_CONFIGURED' ? '请在「设置」中配置可用的 Model Studio 服务密钥。' : chatError}</div>}
      <span className="eyebrow">审核门槛</span><div className="check">每项已选素材都拥有有效授权。</div><div className="check">旅行事实均有已审核证据支持。</div><div className="check">参考内容没有进入最终成片。</div><button className="primary" disabled>导出交付包</button>
    </div>
  </section>;
}

function Settings(): JSX.Element {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [key, setKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [region, setRegion] = useState('cn-beijing');
  const [connection, setConnection] = useState<ProviderConnectionTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    const next = await window.vpMedia.settings.get();
    setSettings(next);
    setBaseUrl(next.providerBaseUrl);
    setRegion(next.providerRegion);
  };
  useEffect(() => { void refresh(); }, []);
  const testConnection = async () => {
    setBusy(true);
    setError(null);
    setConnection(null);
    try {
      await window.vpMedia.settings.saveProviderConfig({ baseUrl, region });
      setConnection(await window.vpMedia.settings.testConnection());
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '无法测试此服务配置。');
    } finally {
      setBusy(false);
    }
  };
  const saveApiKey = async () => {
    setBusy(true);
    setError(null);
    try {
      await window.vpMedia.settings.saveApiKey({ value: key });
      setKey('');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '无法保存 API 密钥。');
    } finally {
      setBusy(false);
    }
  };
  const deleteApiKey = async () => {
    setBusy(true);
    setError(null);
    try {
      await window.vpMedia.settings.deleteApiKey();
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '无法删除 API 密钥。');
    } finally {
      setBusy(false);
    }
  };
  return <section className="settings">
    <div className="card">
      <span className="eyebrow">本地素材库</span>
      <h2>{settings?.libraryPath ?? '尚未选择素材库文件夹'}</h2>
      <button className="secondary" onClick={() => void window.vpMedia.settings.chooseLibrary().then(refresh)}>选择素材库文件夹</button>
    </div>
    <div className="card">
      <span className="eyebrow">AI 服务</span>
      <h2>{settings?.aiKeyConfigured ? 'API 密钥已配置' : '尚未配置 API 密钥'}</h2>
      <p>请使用符合条件的 Model Studio 模型服务密钥。Token Plan 密钥不能作为应用后端凭据。密钥在 SQLite 之外由系统加密保存，永不显示或导出。</p>
      <div className="key-row"><input type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder="输入新生成的 Model Studio 密钥" /><button className="primary" disabled={busy || key.trim().length < 12} onClick={() => void saveApiKey()}>安全保存</button></div>
      {settings?.aiKeyConfigured && <button className="secondary" disabled={busy} onClick={() => void deleteApiKey()}>删除已保存密钥</button>}
      <label>OpenAI 兼容端点<input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} /></label>
      <label>地域<input value={region} onChange={(event) => setRegion(event.target.value)} /></label>
      <button className="secondary" disabled={busy || !settings?.aiKeyConfigured} onClick={() => void testConnection()}>{busy ? '正在发送受限测试请求…' : '保存端点并测试连接'}</button>
      {connection && <div className="notice">{connection.ok ? `已通过 ${connection.model} 连接，耗时 ${connection.latencyMs} 毫秒。` : `连接失败：${connection.errorCode ?? '未知错误'}。`}</div>}
      {error && <div className="notice">连接测试不可用：{error}</div>}
    </div>
  </section>;
}

export function App(): JSX.Element {
  const [page, setPage] = useState<Page>('Library');
  return <main className="shell"><aside><div className="brand"><span>VP</span><div>Media Lab<small>VisePanda 内容工坊</small></div></div><nav>{(Object.keys(pageDescriptions) as Page[]).map((item) => <button key={item} onClick={() => setPage(item)} className={page === item ? 'nav-item selected' : 'nav-item'}>{pageLabels[item]}</button>)}</nav><div className="aside-footer">本地文件 | 人工审核 | 手动发布</div></aside><div className="workspace"><header><div><span className="eyebrow">VP MEDIA LAB</span><h1>{pageLabels[page]}</h1><p>{pageDescriptions[page]}</p></div><div className="status"><i /> 本地工作区</div></header>{page === 'Library' && <Library />}{page === 'Pattern Analysis' && <PatternAnalysis />}{page === 'Create' && <Create />}{page === 'Review & Export' && <ReviewExport />}{page === 'Settings' && <Settings />}</div></main>;
}
