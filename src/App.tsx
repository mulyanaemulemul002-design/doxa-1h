import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { ArrowUpRight, ChevronDown, CircleHelp, Copy, Flame, Grid2X2, ImagePlus, ListFilter, Menu, Search, Sparkles, TrendingUp, Users, Wallet, X, Zap } from 'lucide-react'
import { CandlestickSeries, ColorType, createChart, type IChartApi, type ISeriesApi, type Time } from 'lightweight-charts'
import { ARC_TESTNET, connectArcWallet, formatWalletAddress, getInjectedProvider, getAccountFromPrivateKey, launchTokenOnArc, readArcLaunches, readArcWalletBalances, readTokenBalance, readLaunchesDirect, readNativeBalanceDirect, createLaunchWithPrivateKey, buyWithPrivateKey, type ArcLaunch, type ArcWalletBalances } from './lib/arc'

type MigrationStatus = 'active' | 'graduating' | 'migrated'
type Token = { id: string; launchId: number; tokenAddress: string; name: string; ticker: string; description: string; progress: number; marketCap: number; change: number; price: number; holders: number; volume: number; liquidity: number; creator: string; status: MigrationStatus; visual: string; created: string; createdMinutes: number }

const GRADUATION_TARGET = 182400
const TOKEN_SUPPLY = 1_000_000_000

const visualVariants = ['cat', 'ghost', 'toad', 'baby', 'night', 'pigeon']

function mapLaunchToToken(launch: ArcLaunch, index: number): Token {
  const nativeReserve = Number(launch.nativeReserve) / 1e18
  const marketCap = nativeReserve + (Number(launch.virtualNativeReserve) / 1e18 - nativeReserve)
  const price = marketCap / TOKEN_SUPPLY
  const progress = Math.min((nativeReserve / GRADUATION_TARGET) * 100, 100)
  const status: MigrationStatus = launch.graduated ? 'migrated' : progress >= 90 ? 'graduating' : 'active'
  const createdMinutes = Math.max(1, Math.round((Date.now() / 1000 - Number(launch.createdAt)) / 60))
  const createdLabel = createdMinutes < 60 ? `${createdMinutes}m ago` : createdMinutes < 1440 ? `${Math.floor(createdMinutes / 60)}h ago` : 'yesterday'
  return {
    id: launch.token,
    launchId: index,
    tokenAddress: launch.token,
    name: launch.name,
    ticker: launch.symbol,
    description: launch.description,
    progress,
    marketCap,
    change: 0,
    price,
    holders: 0,
    volume: 0,
    liquidity: nativeReserve,
    creator: launch.creator,
    status,
    visual: visualVariants[index % visualVariants.length],
    created: createdLabel,
    createdMinutes,
  }
}

function useOnChainTokens() {
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    try {
      setLoading(true)
      setError(null)
      const launches = await readLaunchesDirect()
      setTokens(launches.map(mapLaunchToToken))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load on-chain launches.')
      setTokens([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])
  return { tokens, loading, error, refresh }
}

const navItems = [{ label: 'Explore', to: '/' }, { label: 'Create', to: '/create' }]

type WalletState = {
  account: string | null
  balances: ArcWalletBalances | null
  error: string | null
}

function useArcWallet() {
  const [wallet, setWallet] = useState<WalletState>({ account: null, balances: null, error: null })
  const [isConnecting, setIsConnecting] = useState(false)

  const refreshBalances = async (account: string) => {
    try {
      const balances = await readArcWalletBalances(account)
      setWallet((current) => ({ ...current, account, balances, error: null }))
    } catch (error) {
      setWallet((current) => ({ ...current, account, error: error instanceof Error ? error.message : 'Unable to read wallet balance.' }))
    }
  }

  const connect = async () => {
    setIsConnecting(true)
    setWallet((current) => ({ ...current, error: null }))
    try {
      const connection = await connectArcWallet()
      setWallet({ account: connection.account, balances: null, error: null })
      await refreshBalances(connection.account)
    } catch (error) {
      setWallet((current) => ({ ...current, error: error instanceof Error ? error.message : 'Unable to connect wallet.' }))
    } finally {
      setIsConnecting(false)
    }
  }

  useEffect(() => {
    const provider = getInjectedProvider()
    if (!provider) return

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0]
      const account = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : null
      if (account) {
        setWallet((current) => ({ ...current, account, error: null }))
        void refreshBalances(account)
      } else {
        setWallet({ account: null, balances: null, error: null })
      }
    }
    const handleChainChanged = (...args: unknown[]) => {
      const raw = args[0]
      let chainId: string | null = null
      if (typeof raw === 'string') chainId = /^0x/i.test(raw) ? raw.toLowerCase() : `0x${BigInt(raw).toString(16)}`
      else if (typeof raw === 'number' && raw > 0) chainId = `0x${raw.toString(16)}`
      else if (typeof raw === 'bigint') chainId = `0x${raw.toString(16)}`
      if (chainId && chainId !== ARC_TESTNET.chainId) {
        setWallet((current) => ({ ...current, error: 'Switch your wallet back to Arc Testnet to continue.' }))
      }
    }

    void provider.request({ method: 'eth_accounts' }).then(handleAccountsChanged)
    provider.on?.('accountsChanged', handleAccountsChanged)
    provider.on?.('chainChanged', handleChainChanged)
    return () => {
      provider.removeListener?.('accountsChanged', handleAccountsChanged)
      provider.removeListener?.('chainChanged', handleChainChanged)
    }
  }, [])

  return { wallet, connect, isConnecting }
}

function Logo() {
  return <Link to="/" className="brand"><img src="/doxa-logo.png" alt="DOXA" /><span>DOXA<span className="brand-dot">.</span>xyz</span></Link>
}

function Header({ wallet, onConnect, isConnecting }: { wallet: WalletState; onConnect: () => void; isConnecting: boolean }) {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  return <header className="site-header"><div className="header-inner"><Logo /><nav className={menuOpen ? 'nav open' : 'nav'}>{navItems.map((item) => <Link key={item.to} className={location.pathname === item.to ? 'active' : ''} to={item.to} onClick={() => setMenuOpen(false)}>{item.label}</Link>)}{wallet.account && <Link className={location.pathname === '/wallet' ? 'active' : ''} to="/wallet" onClick={() => setMenuOpen(false)}>Wallet</Link>}{!wallet.account && <button className="nav-connect" onClick={() => { setMenuOpen(false); onConnect() }} disabled={isConnecting} style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--mint)', color: '#07100b', border: 0, padding: '12px 16px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}><Wallet size={15} /> {isConnecting ? 'Connecting…' : 'Login / Connect wallet'}</button>}</nav><div className="header-actions"><button className="network"><span className="status-dot" /> ARC testnet <ChevronDown size={14} /></button>{wallet.account ? <Link className="connect" to="/wallet"><Wallet size={15} /> {formatWalletAddress(wallet.account)}</Link> : <button className="connect" onClick={onConnect} disabled={isConnecting}><Wallet size={15} /> {isConnecting ? 'Connecting...' : 'Connect wallet'}</button>}</div><button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button></div>{wallet.error && <div className="container wallet-error" role="status">{wallet.error}</div>}</header>
}

function TokenMark({ variant, large = false }: { variant: string; large?: boolean }) {
  const symbols = { cat: '⌁', ghost: '◒', toad: '·ᴥ·', baby: '◡', night: '✦', pigeon: '⌁' }
  return <div className={`token-mark mark-${variant} ${large ? 'large' : ''}`} aria-hidden="true"><i className="token-orbit" /><span>{symbols[variant as keyof typeof symbols] || '⌁'}</span><b className="token-glint" /></div>
}

function StatusBadge({ status }: { status: MigrationStatus }) {
  const labels = { active: 'Bonding', graduating: 'Graduating', migrated: 'Graduated' }
  return <span className={`status-badge ${status}`}><span /> {labels[status]}</span>
}

const chartPaths = {
  'keyboard-cat': 'M0 78 C18 72 22 56 38 63 S56 71 67 40 S84 47 96 28 S108 22 120 10',
  'arcade-ghost': 'M0 64 C13 58 17 67 28 52 S42 22 54 38 S68 54 78 34 S92 39 101 21 S111 26 120 12',
  'toad-frog': 'M0 24 C13 36 18 21 31 42 S48 34 60 57 S76 41 87 62 S102 55 120 74',
  'usdc-baby': 'M0 69 C15 65 20 52 34 60 S48 46 58 52 S74 37 87 43 S102 24 120 18',
  'night-shift': 'M0 74 C14 73 19 42 32 51 S47 55 58 29 S72 34 80 18 S96 25 104 8 S113 11 120 3',
  'pixel-pigeon': 'M0 68 C13 61 23 70 32 54 S46 39 57 49 S73 43 83 28 S99 35 108 20 S116 18 120 12',
}

type ChartMode = 'trend' | 'candle'
type ChartMetric = 'price' | 'marketCap'

const candleSeries: Record<string, Array<[number, number, number, number, number]>> = {
  'keyboard-cat': [[12, 38, 31, 46, 28], [30, 45, 34, 53, 42], [48, 50, 40, 59, 48], [66, 58, 48, 70, 55], [84, 69, 57, 80, 64], [102, 77, 66, 89, 73]],
  'arcade-ghost': [[12, 30, 22, 42, 28], [30, 40, 27, 51, 36], [48, 44, 33, 58, 40], [66, 55, 38, 66, 52], [84, 63, 49, 75, 58], [102, 74, 57, 86, 69]],
  'toad-frog': [[12, 24, 18, 38, 30], [30, 32, 24, 46, 38], [48, 40, 31, 55, 43], [66, 52, 39, 66, 54], [84, 60, 47, 74, 63], [102, 70, 58, 84, 72]],
  'usdc-baby': [[12, 68, 58, 76, 64], [30, 63, 52, 71, 59], [48, 57, 45, 66, 53], [66, 51, 39, 60, 46], [84, 43, 32, 54, 38], [102, 34, 22, 46, 29]],
  'night-shift': [[12, 38, 28, 50, 34], [30, 48, 35, 60, 44], [48, 55, 43, 66, 51], [66, 64, 50, 75, 59], [84, 73, 59, 84, 68], [102, 82, 68, 92, 77]],
  'pixel-pigeon': [[12, 32, 24, 44, 29], [30, 42, 30, 53, 38], [48, 49, 37, 61, 45], [66, 58, 45, 69, 54], [84, 66, 53, 77, 61], [102, 75, 62, 86, 70]],
}

function TradingViewMarketChart({ token, large = false }: { token: Token; large?: boolean }) {
  const [mode, setMode] = useState<ChartMode>('trend')
  const [metric, setMetric] = useState<ChartMetric>('price')
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!large || mode !== 'candle' || !chartRef.current) return
    const container = chartRef.current
    const chart: IChartApi = createChart(container, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#7d9084', fontFamily: 'DM Mono, monospace', fontSize: 10 },
      grid: { vertLines: { color: 'rgba(70, 100, 80, .16)' }, horzLines: { color: 'rgba(70, 100, 80, .16)' } },
      rightPriceScale: { borderColor: 'rgba(120, 150, 130, .22)', scaleMargins: { top: .12, bottom: .18 } },
      timeScale: { borderColor: 'rgba(120, 150, 130, .22)', timeVisible: true, secondsVisible: false, rightOffset: 2 },
      crosshair: { vertLine: { color: 'rgba(190, 255, 215, .45)', width: 1, style: 2 }, horzLine: { color: 'rgba(190, 255, 215, .45)', width: 1, style: 2 } },
    })
    const candles = candleSeries[token.id] || candleSeries['keyboard-cat']
    const base = metric === 'price' ? token.price : token.marketCap
    const series: ISeriesApi<'Candlestick'> = chart.addSeries(CandlestickSeries, {
      upColor: '#46d889', downColor: '#e07f76', borderVisible: false, wickUpColor: '#46d889', wickDownColor: '#e07f76',
      priceFormat: { type: 'price', precision: metric === 'price' ? 6 : 0, minMove: metric === 'price' ? .000001 : 1 },
    })
    series.setData(candles.map(([time, open, high, low, close], index) => {
      const scale = base / 72
      const offset = index * scale * .018
      return { time: (1710000000 + time * 3600) as Time, open: base + (100 - open) * scale + offset, high: base + (100 - high) * scale + offset, low: base + (100 - low) * scale + offset, close: base + (100 - close) * scale + offset }
    }))
    chart.timeScale().fitContent()
    return () => chart.remove()
  }, [large, mode, metric, token.id, token.marketCap, token.price])

  const toolbar = large && <div className="market-chart-toolbar"><div className="chart-mode-toggle" role="group" aria-label="Chart type"><button className={mode === 'trend' ? 'active' : ''} onClick={() => setMode('trend')} type="button">Trend</button><button className={mode === 'candle' ? 'active' : ''} onClick={() => setMode('candle')} type="button">Candles</button></div><div className="chart-metric-toggle" role="group" aria-label="Chart metric"><button className={metric === 'price' ? 'active' : ''} onClick={() => setMetric('price')} type="button">Price</button><button className={metric === 'marketCap' ? 'active' : ''} onClick={() => setMetric('marketCap')} type="button">Market cap</button></div></div>
  if (mode === 'candle') return <div className={`market-chart ${large ? 'large' : ''} ${token.change < 0 ? 'down' : ''} candles-active`} aria-label={`${token.name} TradingView candlestick chart`}>{toolbar}<div className="tradingview-chart" ref={chartRef} /></div>
  return <div className="market-chart-shell">{toolbar}<MarketChart token={token} large={large} metric={metric} /></div>
}

function MarketChart({ token, large = false, metric = 'price' }: { token: Token; large?: boolean; metric?: ChartMetric }) {
  const line = chartPaths[token.id as keyof typeof chartPaths] || chartPaths['keyboard-cat']
  const area = `${line} L120 100 L0 100 Z`
  return <div className={`market-chart ${large ? 'large' : ''} ${token.change < 0 ? 'down' : ''}`} aria-label={`${token.name} price trend chart`}><div className="market-chart-grid" /><svg viewBox="0 0 120 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id={`fill-${token.id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".28" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs><path className="chart-area" d={area} fill={`url(#fill-${token.id})`} /><path className="chart-line" d={line} fill="none" stroke="currentColor" strokeWidth={large ? '1.6' : '1.8'} vectorEffect="non-scaling-stroke" /></svg>{large && <div className="chart-labels"><span>1H</span><span>6H</span><span>12H</span><span>24H</span><b>{metric === 'price' ? `${token.price.toFixed(5)}` : `${(token.marketCap / 1000).toFixed(1)}K`}</b></div>}</div>
}

function LiveTape() {
  const events = [
    { label: 'NEW', token: 'Mochi Signal', ticker: '$MOCHI', value: 'just launched', tone: 'mint' },
    { label: 'BUY', token: 'Keyboard Cat', ticker: '$KEYS', value: '12.4 USDC', tone: 'buy' },
    { label: 'BUY', token: 'Night Shift', ticker: '$NITE', value: '48.0 USDC', tone: 'buy' },
    { label: 'CURVE', token: 'Arcade Ghost', ticker: '$GHOST', value: '64% filled', tone: 'curve' },
    { label: 'NEW', token: 'Toad Frog', ticker: '$TOAD', value: '18m ago', tone: 'mint' },
  ]
  return <div className="live-tape" aria-label="Live launch activity"><div className="live-tape-label"><span className="pulse" /> Live feed</div><div className="live-tape-window"><div className="live-tape-track">{[...events, ...events].map((event, index) => <span className="live-event" key={`${event.ticker}-${index}`}><b className={`event-label ${event.tone}`}>{event.label}</b><strong>{event.token}</strong><em>{event.ticker}</em><small>{event.value}</small></span>)}</div></div></div>
}

function LaunchCard({ token }: { token: Token }) {
  const isMigrated = token.status === 'migrated'
  return <Link to={`/token/${token.id}`} className={`launch-card card-${token.visual}`}><div className="launch-card-top"><div className="launch-card-identity"><TokenMark variant={token.visual} large /><div><div className="launch-card-name"><h3>{token.name}</h3><span>${token.ticker}</span></div><p>{token.description}</p><div className="launch-card-creator">created by <b>{token.creator}</b></div></div></div><strong className={`launch-change ${token.change < 0 ? 'negative' : 'positive'}`}>{token.change > 0 ? '+' : ''}{token.change}%</strong></div><div className="launch-chart-row"><MarketChart token={token} /><div className="launch-card-stats"><span><small>MARKET CAP</small><b>${(token.marketCap / 1000).toFixed(token.marketCap < 10000 ? 2 : 1)}K</b></span><span><small>VOLUME 24H</small><b>${(token.volume / 1000).toFixed(1)}K</b></span><span><small>HOLDERS</small><b><Users size={12} /> {token.holders}</b></span></div></div><div className="migration-progress"><div className="migration-progress-head"><span><TrendingUp size={13} /> {isMigrated ? 'Graduated & migrated' : token.status === 'graduating' ? 'Near graduation' : 'Bonding curve progress'}</span><b>{token.progress.toFixed(3)}%</b></div><div className={`migration-track ${isMigrated ? 'complete' : ''}`}><span style={{ width: `${token.progress}%` }} /><i style={{ left: `${Math.min(token.progress, 99.4)}%` }} /></div><div className="migration-foot"><span>{isMigrated ? 'Liquidity migrated to market' : `${(100 - token.progress).toFixed(1)}% until migration`}</span><small>{token.created}</small></div></div></Link>
}

function Explore({ tokens, tokensLoading, tokensError, onRefresh }: { tokens: Token[]; tokensLoading: boolean; tokensError: string | null; onRefresh: () => void }) {
  const [filter, setFilter] = useState('Trending')
  const [statusFilter, setStatusFilter] = useState<MigrationStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const filteredTokens = useMemo(() => tokens.filter((token) => (statusFilter === 'all' || token.status === statusFilter) && `${token.name} ${token.ticker}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => filter === 'New launches' ? a.createdMinutes - b.createdMinutes : filter === 'Graduating' ? b.progress - a.progress : b.change - a.change), [filter, search, statusFilter, tokens])
  const trending = [...tokens].sort((a, b) => b.progress - a.progress).slice(0, 3)
  if (tokensLoading) return <main className="home-shell"><div className="container" style={{ padding: '120px 32px', textAlign: 'center' }}><div className="eyebrow"><span className="pulse" /> Loading on-chain data</div><h2 style={{ marginTop: 16 }}>Reading launches from Arc testnet…</h2></div></main>
  if (tokensError) return <main className="home-shell"><div className="container" style={{ padding: '120px 32px', textAlign: 'center' }}><div className="eyebrow" style={{ color: 'var(--market-negative)' }}>Connection error</div><h2 style={{ marginTop: 16 }}>{tokensError}</h2><button className="button primary" onClick={onRefresh} style={{ marginTop: 20 }}>Retry</button></div></main>
  if (tokens.length === 0) return <main className="home-shell"><div className="container" style={{ padding: '120px 32px', textAlign: 'center' }}><div className="eyebrow"><span className="pulse" /> No launches yet</div><h2 style={{ marginTop: 16 }}>No tokens have been launched on this contract yet.</h2><Link className="button primary" to="/create" style={{ marginTop: 20 }}>Create the first launch <ArrowUpRight size={16} /></Link></div></main>
  return <main className="home-shell"><section className="home-hero container"><div className="home-hero-copy"><div className="eyebrow"><span className="pulse" /> ARC / USDC launchpad</div><h1>Launch early.<br /><span>Trade loud.</span></h1><p>A live board for the tokens forming conviction on Arc. Find the newest launches, watch the curve fill, and move before the crowd.</p><div className="hero-actions"><Link className="button primary" to="/create">Create launch <ArrowUpRight size={16} /></Link><a className="text-link" href="#explore">View new launches <span>↓</span></a></div><div className="home-stats"><span><b>{String(tokens.length).padStart(2, '0')}</b> tracked launches</span><span><b>01%</b> platform fee</span><span><b>ARC</b> testnet live</span></div></div><div className="signal-panel"><div className="signal-panel-top"><span><span className="pulse" /> Featured curve</span><span>{String(Math.min(trending.length, 3)).padStart(2, '0')} / 03</span></div><div className="signal-token"><TokenMark variant={trending[0].visual} large /><div><span className="signal-kicker">Moving now</span><h2>{trending[0].name}</h2><strong>${trending[0].ticker}</strong></div><b className="positive">{trending[0].progress.toFixed(1)}%</b></div><div className="signal-chart"><TradingViewMarketChart token={trending[0]} large /></div><div className="signal-metrics"><span><small>PRICE</small>${trending[0].price.toFixed(5)}</span><span><small>MARKET CAP</small>${(trending[0].marketCap / 1000).toFixed(1)}K</span><span><small>CURVE</small>{trending[0].progress.toFixed(1)}%</span></div><Link className="signal-link" to={`/token/${trending[0].id}`}>Open terminal <ArrowUpRight size={15} /></Link></div></section><LiveTape /><section id="explore" className="launch-board container"><div className="board-heading"><div><div className="eyebrow">Launch terminal</div><h2>Find your next <span>runner.</span></h2><p>Fresh launches and curves in motion, sorted for fast decisions.</p></div><div className="board-count"><strong>{filteredTokens.length}</strong><span>visible launches</span></div></div><div className="board-controls"><div className="filters">{['Trending', 'New launches', 'Graduating'].map((item) => <button key={item} className={filter === item ? 'filter active' : 'filter'} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="search-box"><Search size={16} /><input aria-label="Search tokens" placeholder="Search ticker or launch" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div><div className="launch-discovery-bar"><div className="launch-status-tabs">{([{ value: 'all', label: 'All tokens' }, { value: 'active', label: 'Bonding' }, { value: 'graduating', label: 'Near graduation' }, { value: 'migrated', label: 'Migrated' }] as const).map((item) => <button key={item.value} className={statusFilter === item.value ? 'active' : ''} onClick={() => setStatusFilter(item.value)}>{item.label}</button>)}</div><div className="launch-toolbar-actions"><button onClick={onRefresh} style={{ background: 'transparent', border: '1px solid #2c4333', color: '#70dc8b', borderRadius: 8, padding: '6px 10px', font: '10px DM Mono', cursor: 'pointer' }}>Refresh</button><span><Flame size={14} /> Live board</span><button aria-label="Grid view" className="view-toggle active"><Grid2X2 size={15} /></button><button aria-label="Filter options" className="view-toggle"><ListFilter size={15} /></button></div></div><div className="launch-grid">{filteredTokens.map((token) => <LaunchCard key={token.id} token={token} />)}</div></section></main>
}

function MobileNav() {
  const location = useLocation()
  return <nav className="mobile-nav"><Link className={location.pathname === '/' ? 'active' : ''} to="/"><Search size={19} /><span>Explorer</span></Link><Link className={location.pathname === '/create' ? 'active' : ''} to="/create"><Sparkles size={19} /><span>Create</span></Link></nav>
}

function Create({ wallet, onConnect }: { wallet: WalletState; onConnect: () => void }) {
  const [name, setName] = useState('')
  const [ticker, setTicker] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageName, setImageName] = useState('')
  const [launched, setLaunched] = useState(false)
  const [launchHash, setLaunchHash] = useState<string | null>(null)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [isLaunching, setIsLaunching] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setImageName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setImageUrl(reader.result)
    }
    reader.readAsDataURL(file)
  }
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLaunchError(null)
    if (!wallet.account) {
      onConnect()
      return
    }
    setIsLaunching(true)
    try {
      const hash = await launchTokenOnArc(wallet.account, name.trim(), ticker.trim(), description.trim())
      setLaunchHash(hash)
      setLaunched(true)
    } catch (error) {
      setLaunchError(error instanceof Error ? error.message : 'Unable to launch token.')
    } finally {
      setIsLaunching(false)
    }
  }
  return <main className="container page"><div className="page-intro"><div><div className="eyebrow">Start something</div><h1>Launch a token<br /><span>people remember.</span></h1><p>Every great meme starts with a name and a little conviction. The rest is up to the crowd.</p></div><div className="mock-note"><CircleHelp size={16} /><span>On-chain launch / wallet signature required</span></div></div><div className="create-layout"><form className="form-panel" onSubmit={handleSubmit}><div className="panel-heading"><span>01</span><h2>Token details</h2></div><label>Token name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Keyboard Cat" maxLength={28} required /></label><label>Ticker<span className="input-prefix">$ <input value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} placeholder="KEYS" maxLength={8} required /></span></label><label>What’s the story?<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Give the internet a reason to care..." maxLength={120} required /></label><label>Token image<input ref={fileInputRef} style={{ display: 'none' }} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleImageChange} /><div className="upload-box"><ImagePlus size={20} /><div><b>{imageName || 'Drop an image here'}</b><small>PNG, JPG, GIF or WEBP / 4MB max</small></div><button type="button" onClick={() => fileInputRef.current?.click()}>{imageName ? 'Change' : 'Browse'}</button></div></label><div className="optional-row"><label>Website <span className="field-optional">Optional</span><input type="url" placeholder="https://" /></label><label>X / Twitter <span className="field-optional">Optional</span><input placeholder="@handle" /></label><label>Telegram <span className="field-optional">Optional</span><input placeholder="@channel" /></label></div><button className="button primary launch-button" type="submit" disabled={isLaunching}>{isLaunching ? 'Waiting for wallet...' : launched ? 'Transaction sent' : wallet.account ? 'Launch on ARC' : 'Connect wallet to launch'} <ArrowUpRight size={16} /></button>{launchHash && <p className="form-success">Transaction sent: <a href={`${ARC_TESTNET.explorerUrl}/tx/${launchHash}`} target="_blank" rel="noreferrer">{formatWalletAddress(launchHash)}</a></p>}{launchError && <p className="form-error" role="alert">{launchError}</p>}<p className="form-footnote">Your wallet will ask you to confirm the `createLaunch` transaction on Arc Testnet.</p></form><Preview name={name} ticker={ticker} description={description} imageUrl={imageUrl} /></div></main>
}

function Preview({ name, ticker, description, imageUrl }: { name: string; ticker: string; description: string; imageUrl: string }) {
  return <aside className="preview"><div className="preview-label">Live preview</div><div className="preview-card"><div className="preview-image">{imageUrl ? <img src={imageUrl} alt={`${name || 'Your token'} preview`} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} /> : <TokenMark variant="baby" large />}<span>YOUR TOKEN</span></div><div className="preview-content"><div className="card-name"><div><h3>{name || 'Your token name'}</h3><span>${ticker || 'TICKER'}</span></div><StatusBadge status="active" /></div><p>{description || 'Your story goes here. Make it weird, make it yours.'}</p><div className="progress-meta"><span>Bonding curve</span><b>0%</b></div><div className="progress-track"><span style={{ width: '0%' }} /></div><div className="card-stats"><div><small>Market cap</small><strong>$0</strong></div><div><small>24h</small><strong className="positive">—</strong></div></div></div></div><div className="preview-tip"><Sparkles size={16} /><span>Your token starts at zero. Every holder writes the next chapter.</span></div></aside>
}

type WalletLaunch = {
  launch: ArcLaunch
  balance: string
}

function formatArcAmount(value: bigint): string {
  return Number(value) / 1e18 >= 1000
    ? `${(Number(value) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : `${(Number(value) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function WalletDashboard({ wallet, onConnect, isConnecting }: { wallet: WalletState; onConnect: () => void; isConnecting: boolean }) {
  const [launches, setLaunches] = useState<WalletLaunch[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!wallet.account) {
      setLaunches([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void readArcLaunches()
      .then(async (allLaunches) => {
        const withBalances = await Promise.all(allLaunches.map(async (launch) => ({
          launch,
          balance: await readTokenBalance(launch.token, wallet.account as string),
        })))
        if (!cancelled) setLaunches(withBalances.filter(({ launch, balance }) => launch.creator.toLowerCase() === wallet.account?.toLowerCase() || Number(balance) > 0))
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load on-chain holdings.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [wallet.account])

  if (!wallet.account) {
    return <main className="container page wallet-page"><div className="wallet-empty"><div className="eyebrow">Your wallet</div><h1>Connect to see<br /><span>your position.</span></h1><p>Track your Arc USDC balance, token holdings, launches, and creator rewards from one place.</p><button className="button primary" onClick={onConnect} disabled={isConnecting}><Wallet size={15} /> {isConnecting ? 'Connecting...' : 'Connect wallet'}</button></div></main>
  }

  const created = launches.filter(({ launch }) => launch.creator.toLowerCase() === wallet.account?.toLowerCase())
  const holdings = launches.filter(({ balance }) => Number(balance) > 0)
  return <main className="container page wallet-page"><div className="wallet-heading"><div><div className="eyebrow"><span className="pulse" /> Wallet overview</div><h1>Your wallet<br /><span>at a glance.</span></h1><p>{formatWalletAddress(wallet.account)} · Arc Testnet</p></div><a className="button secondary" href={`${ARC_TESTNET.explorerUrl}/address/${wallet.account}`} target="_blank" rel="noreferrer">View on explorer <ArrowUpRight size={15} /></a></div><section className="wallet-balance-grid"><div className="balance-card balance-main"><div className="balance-card-top"><span>Total balance</span><span className="wallet-live"><span className="pulse" /> LIVE</span></div><strong>{wallet.balances?.nativeUsdc ?? '—'} <small>USDC</small></strong><p>Native USDC available for Arc Testnet gas and trading.</p><div className="balance-address">{wallet.account}</div></div><div className="balance-card"><span>ERC-20 USDC</span><strong>{wallet.balances?.erc20Usdc ?? '—'} <small>USDC</small></strong><p>Token balance detected in your connected wallet.</p></div><div className="balance-card creator-fee-card"><span>Creator fee share</span><strong>0.00 <small>USDC</small></strong><p>Not enabled in the deployed contract. Current fees route to the treasury.</p><span className="fee-status">Platform fee 1% · creator share 0%</span></div></section><section className="wallet-content"><div className="wallet-section"><div className="wallet-section-heading"><div><div className="eyebrow">Your assets</div><h2>Token holdings.</h2></div><span className="section-count">{holdings.length} assets</span></div>{loading ? <div className="wallet-placeholder">Reading token balances from Arc...</div> : holdings.length ? <div className="wallet-token-list">{holdings.map(({ launch, balance }) => <a href={`${ARC_TESTNET.explorerUrl}/address/${launch.token}`} target="_blank" rel="noreferrer" className="wallet-token-row" key={launch.token}><span className="wallet-token-mark">{launch.symbol.slice(0, 1)}</span><span><strong>{launch.name}</strong><small>${launch.symbol}</small></span><b>{balance}</b><ArrowUpRight size={15} /></a>)}</div> : <div className="wallet-placeholder">No token holdings yet. Explore a launch and make your first trade.</div>}</div><div className="wallet-section"><div className="wallet-section-heading"><div><div className="eyebrow">Creator studio</div><h2>Tokens you created.</h2></div><span className="section-count">{created.length} launches</span></div>{loading ? <div className="wallet-placeholder">Loading launches...</div> : created.length ? <div className="created-list">{created.map(({ launch }) => <div className="created-row" key={launch.token}><div><strong>{launch.name} <span>${launch.symbol}</span></strong><small>{formatArcAmount(launch.nativeReserve)} USDC raised · {launch.graduated ? 'Graduated' : 'Active curve'}</small></div><a href={`${ARC_TESTNET.explorerUrl}/address/${launch.token}`} target="_blank" rel="noreferrer">Contract <ArrowUpRight size={13} /></a></div>)}</div> : <div className="wallet-placeholder">Your on-chain launches will show here after you create one.</div>}</div></section>{error && <p className="form-error" role="alert">{error}</p>}<div className="wallet-fee-note"><Sparkles size={16} /><div><strong>Creator rewards are ready for the next contract iteration.</strong><p>The deployed launchpad currently sends the configured 1% trading fee to the treasury only. This UI keeps the creator share visible without inventing a balance that the contract cannot pay yet.</p></div></div></main>
}

function TradePanel({ token, onConnect, connected }: { token: Token; onConnect: () => void; connected: boolean }) {
  const [side, setSide] = useState<'Buy' | 'Sell'>('Buy')
  const [amount, setAmount] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const value = Number(amount || 0)
  const payingSymbol = side === 'Buy' ? 'USDC' : `$${token.ticker}`
  const receivingSymbol = side === 'Buy' ? `$${token.ticker}` : 'USDC'
  const receivedValue = side === 'Buy' ? value / token.price : value * token.price
  return <div className="trade-panel"><div className="trade-tabs"><button className={side === 'Buy' ? 'active' : ''} onClick={() => setSide('Buy')}>Buy</button><button className={side === 'Sell' ? 'active sell' : ''} onClick={() => setSide('Sell')}>Sell</button></div><div className="trade-body"><div className="trade-label"><span>You pay</span><button>{payingSymbol} <ChevronDown size={13} /></button></div><div className="amount-field"><input value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" inputMode="decimal" /><span>{payingSymbol}</span></div><div className="quick-amounts"><button onClick={() => setAmount('10')}>10</button><button onClick={() => setAmount('50')}>50</button><button onClick={() => setAmount('100')}>100</button><button onClick={() => setAmount('500')}>500</button></div><div className="trade-label second"><span>You receive</span><span className="muted">Estimated</span></div><div className="receive-field"><strong>{value ? receivedValue.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0.00'}</strong><span>{receivingSymbol}</span></div><div className="trade-summary"><span>Price impact <b>0.12%</b></span><span>Network fee <b>~$0.01</b></span></div><button className="button primary trade-button" onClick={() => { if (!connected) onConnect(); else setSubmitted(true) }} disabled={submitted}>{submitted ? <><Sparkles size={15} /> Preview order submitted</> : <><Wallet size={15} /> {connected ? `${side} ${token.ticker}` : `Connect wallet to ${side.toLowerCase()}`}</>}</button><span className="trade-mock">{submitted ? 'Demo state complete / no transaction was sent' : 'UI preview only / no transaction will be sent'}</span></div></div>
}

function Detail({ onConnect, wallet, tokens }: { onConnect: () => void; wallet: WalletState; tokens: Token[] }) {
  const { id } = useParams()
  const token = tokens.find((item) => item.id === id) || tokens[0]
  const [copied, setCopied] = useState(false)
  const copyAddress = () => { void navigator.clipboard?.writeText('0x8f...doxa'); setCopied(true); window.setTimeout(() => setCopied(false), 1600) }
  return <main className="container page detail-page"><Link to="/" className="back-link">← Back to explore</Link><div className="detail-heading"><div className="detail-token"><TokenMark variant={token.visual} large /><div><div className="eyebrow"><StatusBadge status={token.status} /></div><h1>{token.name} <span>${token.ticker}</span></h1><p>{token.description}</p><button className="address" onClick={copyAddress}>{copied ? 'Copied to clipboard' : 'ARC / 0x8f...doxa'} <Copy size={13} /></button></div></div><div className="detail-actions"><button className="icon-button"><Search size={16} /></button><button className="button primary" onClick={onConnect}><Wallet size={15} /> {wallet.account ? formatWalletAddress(wallet.account) : 'Connect wallet'}</button></div></div><div className="detail-grid"><div><div className="detail-chart-shell"><TradingViewMarketChart token={token} large /></div><div className="curve-card"><div className="curve-header"><div><span>Bonding curve progress</span><strong>{token.progress}%</strong></div><span>{token.progress >= 100 ? 'Graduated' : `$${(182400 - token.marketCap).toLocaleString()} to graduation`}</span></div><div className="curve-track"><span style={{ width: `${token.progress}%` }} /><i style={{ left: `${token.progress}%` }} /></div><div className="curve-foot"><span>Launched <b>0 USDC</b></span><span>Graduation target <b>$182.4K</b></span></div></div><MigrationCard status={token.status} /></div><aside><TradePanel token={token} onConnect={onConnect} connected={Boolean(wallet.account)} /><div className="holders-card"><div className="small-heading"><h3>Top holders</h3><a href="#holders">View all</a></div>{['0x4a…91f', '0x8f…doxa', '0xc2…52a', '0x12…b8e'].map((holder, index) => <div className="holder-row" key={holder}><span className="holder-rank">0{index + 1}</span><span>{holder}</span><b>{[12.4, 8.2, 5.8, 4.1][index]}%</b></div>)}</div></aside></div></main>
}

function MigrationCard({ status }: { status: MigrationStatus }) {
  const migrated = status === 'migrated'
  return <div className={`migration-card ${migrated ? 'migrated' : ''}`}><div className="migration-icon">{migrated ? '✓' : <Zap size={20} />}</div><div><div className="eyebrow">{migrated ? 'Migration complete' : 'The roadmap'}</div><h3>{migrated ? 'Now trading on ARC mainnet' : status === 'graduating' ? 'Almost ready for the next stop' : 'Build toward the big move'}</h3><p>{migrated ? 'This token graduated from its bonding curve and is now available on the open market.' : 'At 100%, liquidity migrates to Uniswap on ARC Mainnet. This is a preview of what comes next.'}</p></div></div>
}

const ADMIN_BOTS_STORAGE = 'doxa_admin_bots'
const ADMIN_KEY_STORAGE = 'doxa_admin_pk'

type Bot = { privateKey: string; address: string; balance: string }
type BuyResult = { address: string; hash?: string; error?: string }

const inputStyle = { width: '100%', padding: '10px 12px', background: '#050706', border: '1px solid #28382f', borderRadius: 8, color: '#f1f6f3', fontFamily: 'DM Mono, monospace', fontSize: 13, marginTop: 4 } as const
const panelStyle = { padding: '22px 24px', background: '#0b100d', border: '1px solid #28382f', borderRadius: 14, marginBottom: 20 } as const

function AdminPanel({ onRefreshTokens }: { onRefreshTokens: () => void }) {
  const [bots, setBots] = useState<Bot[]>([])
  const [newKey, setNewKey] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [ticker, setTicker] = useState('')
  const [description, setDescription] = useState('')
  const [createAddr, setCreateAddr] = useState('')
  const [createHash, setCreateHash] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const [buyLaunchId, setBuyLaunchId] = useState('')
  const [buyAmount, setBuyAmount] = useState('')
  const [selectedAddrs, setSelectedAddrs] = useState<string[]>([])
  const [buyResults, setBuyResults] = useState<BuyResult[]>([])
  const [buyError, setBuyError] = useState<string | null>(null)
  const [isBuying, setIsBuying] = useState(false)

  const persist = (list: Bot[]) => localStorage.setItem(ADMIN_BOTS_STORAGE, JSON.stringify(list.map((b) => b.privateKey)))

  const refreshBalance = (address: string) => {
    void readNativeBalanceDirect(address).then((bal) => setBots((cur) => cur.map((b) => b.address === address ? { ...b, balance: bal } : b))).catch(() => { /* ignore */ })
  }

  useEffect(() => {
    const keys: string[] = []
    const raw = localStorage.getItem(ADMIN_BOTS_STORAGE)
    if (raw) { try { for (const k of JSON.parse(raw) as string[]) keys.push(k) } catch { /* ignore */ } }
    const legacy = localStorage.getItem(ADMIN_KEY_STORAGE)
    if (legacy && !keys.includes(legacy)) keys.push(legacy)
    const loaded: Bot[] = []
    for (const k of keys) {
      try { loaded.push({ privateKey: k, address: getAccountFromPrivateKey(k), balance: '' }) } catch { /* skip invalid */ }
    }
    setBots(loaded)
    loaded.forEach((b) => refreshBalance(b.address))
  }, [])

  const addBot = () => {
    setAddError(null)
    const key = newKey.trim()
    if (!key) return
    let address: string
    try { address = getAccountFromPrivateKey(key) } catch { setAddError('Invalid private key format.'); return }
    if (bots.some((b) => b.address.toLowerCase() === address.toLowerCase())) { setAddError('This bot is already added.'); return }
    const list = [...bots, { privateKey: key, address, balance: '' }]
    setBots(list)
    persist(list)
    setNewKey('')
    refreshBalance(address)
  }

  const removeBot = (address: string) => {
    const list = bots.filter((b) => b.address !== address)
    setBots(list)
    persist(list)
    setSelectedAddrs((cur) => cur.filter((a) => a !== address))
  }

  const lockAll = () => {
    localStorage.removeItem(ADMIN_BOTS_STORAGE)
    localStorage.removeItem(ADMIN_KEY_STORAGE)
    setBots([])
    setSelectedAddrs([])
  }

  const toggleSelected = (address: string) => setSelectedAddrs((cur) => cur.includes(address) ? cur.filter((a) => a !== address) : [...cur, address])
  const allSelected = bots.length > 0 && selectedAddrs.length === bots.length
  const toggleAll = () => setSelectedAddrs(allSelected ? [] : bots.map((b) => b.address))

  const handleCreate = async () => {
    setCreateError(null)
    setCreateHash(null)
    const signer = bots.find((b) => b.address === createAddr) ?? bots[0]
    if (!signer) { setCreateError('Add a bot first.'); return }
    if (!name.trim() || !ticker.trim() || !description.trim()) {
      setCreateError('Name, ticker, and description are required.')
      return
    }
    setIsCreating(true)
    try {
      const hash = await createLaunchWithPrivateKey(signer.privateKey, name.trim(), ticker.trim(), description.trim())
      setCreateHash(hash)
      void onRefreshTokens()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create token.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCoordinatedBuy = async () => {
    setBuyError(null)
    setBuyResults([])
    const launchId = Number(buyLaunchId)
    const amount = Number(buyAmount)
    if (!Number.isFinite(launchId) || launchId < 0) { setBuyError('Valid launch ID is required.'); return }
    if (!Number.isFinite(amount) || amount <= 0) { setBuyError('Valid USDC amount is required.'); return }
    const targets = bots.filter((b) => selectedAddrs.includes(b.address))
    if (targets.length === 0) { setBuyError('Select at least one bot to buy with.'); return }
    setIsBuying(true)
    const nativeIn = BigInt(Math.round(amount * 1e18))
    const settled = await Promise.allSettled(targets.map((b) => buyWithPrivateKey(b.privateKey, launchId, nativeIn)))
    setBuyResults(targets.map((b, i) => {
      const r = settled[i]
      return r.status === 'fulfilled' ? { address: b.address, hash: r.value } : { address: b.address, error: r.reason instanceof Error ? r.reason.message : 'Failed' }
    }))
    void onRefreshTokens()
    targets.forEach((b) => refreshBalance(b.address))
    setIsBuying(false)
  }

  if (bots.length === 0) {
    return <main className="container page" style={{ paddingTop: 80, maxWidth: 460 }}>
      <div className="eyebrow" style={{ color: 'var(--market-warning)' }}>Admin / Bot control</div>
      <h1 style={{ fontSize: 28, marginTop: 8 }}>Add your first bot</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>Paste a bot wallet private key to begin. You can add several bots and have them buy together. Keys are stored only in your browser's localStorage and never sent to any server.</p>
      <input type="password" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="0x... private key" style={{ ...inputStyle, marginTop: 16 }} />
      <button className="button primary" onClick={addBot} style={{ marginTop: 14, width: '100%' }}>Add bot</button>
      {addError && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{addError}</p>}
    </main>
  }

  return <main className="container page" style={{ paddingTop: 60, maxWidth: 620 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
      <div>
        <div className="eyebrow" style={{ color: 'var(--market-warning)' }}>Admin / Bot control</div>
        <h1 style={{ fontSize: 26, marginTop: 8 }}>Bot dashboard</h1>
      </div>
      <button onClick={lockAll} style={{ background: 'transparent', border: '1px solid #28382f', color: 'var(--muted)', borderRadius: 8, padding: '8px 14px', font: '11px DM Mono', cursor: 'pointer' }}>Lock & clear keys</button>
    </div>

    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Bots ({bots.length})</h2>
        <button onClick={toggleAll} style={{ background: 'transparent', border: '1px solid #28382f', color: 'var(--mint)', borderRadius: 8, padding: '6px 12px', font: '10px DM Mono', cursor: 'pointer' }}>{allSelected ? 'Deselect all' : 'Select all'}</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {bots.map((b, i) => <div key={b.address} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#050706', border: `1px solid ${selectedAddrs.includes(b.address) ? 'var(--mint)' : '#28382f'}`, borderRadius: 10 }}>
          <input type="checkbox" checked={selectedAddrs.includes(b.address)} onChange={() => toggleSelected(b.address)} style={{ accentColor: '#2ee6a0', width: 16, height: 16 }} aria-label={`Select bot ${i + 1}`} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '10px DM Mono', color: 'var(--muted)' }}>BOT {String(i + 1).padStart(2, '0')}</div>
            <div style={{ font: '12px DM Mono', wordBreak: 'break-all' }}>{b.address}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ font: '9px DM Mono', color: 'var(--muted)' }}>USDC</div>
            <div style={{ font: '13px DM Mono', color: 'var(--market-positive)' }}>{b.balance || '—'}</div>
          </div>
          <button onClick={() => removeBot(b.address)} aria-label="Remove bot" style={{ background: 'transparent', border: '1px solid #28382f', color: 'var(--market-negative)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
        </div>)}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input type="password" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="0x... add another bot" style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
        <button className="button primary" onClick={addBot} style={{ whiteSpace: 'nowrap' }}>Add bot</button>
      </div>
      {addError && <p className="form-error" role="alert" style={{ marginTop: 10 }}>{addError}</p>}
    </div>

    <div style={panelStyle}>
      <h2 style={{ fontSize: 16, marginBottom: 16 }}>Coordinated buy (simultaneous)</h2>
      <p style={{ color: 'var(--muted)', fontSize: 12, margin: '0 0 16px' }}>Fires a buy from every selected bot at the same time — {selectedAddrs.length} bot{selectedAddrs.length === 1 ? '' : 's'} selected.</p>
      <label style={{ display: 'block', marginBottom: 12 }}><span style={{ font: '10px DM Mono', color: 'var(--muted)' }}>LAUNCH ID</span><input value={buyLaunchId} onChange={(e) => setBuyLaunchId(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" inputMode="numeric" style={inputStyle} /></label>
      <label style={{ display: 'block', marginBottom: 12 }}><span style={{ font: '10px DM Mono', color: 'var(--muted)' }}>USDC AMOUNT (PER BOT)</span><input value={buyAmount} onChange={(e) => setBuyAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="10.0" inputMode="decimal" style={inputStyle} /></label>
      <button className="button primary" onClick={handleCoordinatedBuy} disabled={isBuying} style={{ marginTop: 4 }}>{isBuying ? 'Sending...' : `Buy with ${selectedAddrs.length || 'selected'} bot${selectedAddrs.length === 1 ? '' : 's'}`}</button>
      {buyError && <p className="form-error" role="alert" style={{ marginTop: 10 }}>{buyError}</p>}
      {buyResults.length > 0 && <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>{buyResults.map((r) => <div key={r.address} style={{ font: '11px DM Mono', padding: '8px 10px', background: '#050706', border: '1px solid #28382f', borderRadius: 8 }}><span style={{ color: 'var(--muted)' }}>{formatWalletAddress(r.address)}</span> {r.hash ? <span className="form-success">→ <a href={`${ARC_TESTNET.explorerUrl}/tx/${r.hash}`} target="_blank" rel="noreferrer">{formatWalletAddress(r.hash)}</a></span> : <span style={{ color: 'var(--market-negative)' }}>→ {r.error}</span>}</div>)}</div>}
    </div>

    <div style={{ ...panelStyle, marginBottom: 0 }}>
      <h2 style={{ fontSize: 16, marginBottom: 16 }}>Create token</h2>
      <label style={{ display: 'block', marginBottom: 12 }}><span style={{ font: '10px DM Mono', color: 'var(--muted)' }}>SIGNER BOT</span><select value={createAddr || bots[0]?.address || ''} onChange={(e) => setCreateAddr(e.target.value)} style={inputStyle}>{bots.map((b, i) => <option key={b.address} value={b.address}>Bot {String(i + 1).padStart(2, '0')} — {formatWalletAddress(b.address)}</option>)}</select></label>
      <label style={{ display: 'block', marginBottom: 12 }}><span style={{ font: '10px DM Mono', color: 'var(--muted)' }}>NAME</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Token name" maxLength={28} style={inputStyle} /></label>
      <label style={{ display: 'block', marginBottom: 12 }}><span style={{ font: '10px DM Mono', color: 'var(--muted)' }}>TICKER</span><input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} placeholder="TICKER" maxLength={8} style={inputStyle} /></label>
      <label style={{ display: 'block', marginBottom: 12 }}><span style={{ font: '10px DM Mono', color: 'var(--muted)' }}>DESCRIPTION</span><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" maxLength={120} style={inputStyle} /></label>
      <button className="button primary" onClick={handleCreate} disabled={isCreating} style={{ marginTop: 4 }}>{isCreating ? 'Sending...' : 'Create token'}</button>
      {createHash && <p className="form-success" style={{ marginTop: 10 }}>TX: <a href={`${ARC_TESTNET.explorerUrl}/tx/${createHash}`} target="_blank" rel="noreferrer">{formatWalletAddress(createHash)}</a></p>}
      {createError && <p className="form-error" role="alert" style={{ marginTop: 10 }}>{createError}</p>}
    </div>
  </main>
}

function App() {
  const { wallet, connect, isConnecting } = useArcWallet()
  const { tokens, loading: tokensLoading, error: tokensError, refresh: refreshTokens } = useOnChainTokens()
  return <><Header wallet={wallet} onConnect={connect} isConnecting={isConnecting} /><Routes><Route path="/" element={<Explore tokens={tokens} tokensLoading={tokensLoading} tokensError={tokensError} onRefresh={refreshTokens} />} /><Route path="/create" element={<Create wallet={wallet} onConnect={connect} />} /><Route path="/wallet" element={<WalletDashboard wallet={wallet} onConnect={connect} isConnecting={isConnecting} />} /><Route path="/token/:id" element={<Detail onConnect={connect} wallet={wallet} tokens={tokens} />} /><Route path="/admin" element={<AdminPanel onRefreshTokens={refreshTokens} />} /></Routes><MobileNav /><footer className="site-footer"><div className="container footer-inner"><Logo /><span>Built for the ARC testnet.</span><span className="footer-right"><Link to="/admin" style={{ color: 'inherit', marginRight: 16 }}>Admin panel</Link>DOXA.xyz / 2026</span></div></footer></>
}

export default App
