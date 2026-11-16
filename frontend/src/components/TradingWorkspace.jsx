import { useEffect, useState } from "react";
import { api, money } from "../services/api";
import { useResource } from "../hooks/useResource";
import { Card, Holdings, Notice, Table } from "./Common";
import StockOrderForm, { orderNames } from "./StockOrderForm";
import "../styles/trading.css";

function PriceChart({ candles = [] }) {
  const bars = candles.slice(-90);
  if (!bars.length) return <div className="stock-chart-empty">Select a stock to view its price history.</div>;
  const low = Math.min(...bars.map(b => b.low)), high = Math.max(...bars.map(b => b.high));
  const range = high - low || 1, y = v => 220 - (v-low)/range*180, dx = 650/bars.length;
  return <svg viewBox="0 0 760 265" className="stock-chart" role="img" aria-label="Stock price candlestick chart">
    {[0,1,2,3,4].map(i => <g key={i}><line x1="58" x2="730" y1={40+i*45} y2={40+i*45} stroke="var(--gray-200)"/><text x="4" y={44+i*45} fill="var(--gray-500)" fontSize="11">{(high-range*i/4).toFixed(0)}</text></g>)}
    {bars.map((b,i) => <g key={b.time+i} stroke={b.close>=b.open?"#16a36b":"#e34b5f"} fill={b.close>=b.open?"#16a36b":"#e34b5f"}><title>{b.time}: O {b.open} H {b.high} L {b.low} C {b.close}</title><line x1={65+i*dx} x2={65+i*dx} y1={y(b.high)} y2={y(b.low)}/><rect x={65+i*dx-dx*.3} y={y(Math.max(b.open,b.close))} width={Math.max(1,dx*.6)} height={Math.max(1.5,Math.abs(y(b.open)-y(b.close)))}/></g>)}
    {[0,.5,1].map((f,i)=><text key={i} x={65+f*650} y="253" textAnchor={i===2?"end":"start"} fill="var(--gray-500)" fontSize="11">{bars[Math.floor(f*(bars.length-1))].time}</text>)}
  </svg>;
}
export default function TradingWorkspace({ user, initialSymbol = "RELIANCE" }) {
  const status = useResource("/algo/status", {}), portfolio = useResource("/algo/portfolio", {}, 10000);
  const [query,setQuery] = useState(initialSymbol), [search,setSearch] = useState(initialSymbol), [selected,setSelected] = useState(null);
  const [side,setSide] = useState("BUY");
  const [watchlistId,setWatchlistId] = useState("");
  const [busy,setBusy] = useState(false), [error,setError] = useState(""), [notice,setNotice] = useState(""), [period,setPeriod] = useState(30);
  const instruments = useResource("/algo/search?q="+encodeURIComponent(search), {});
  useEffect(() => { if (!selected && instruments.data.instruments?.length) setSelected(instruments.data.instruments[0]); }, [instruments.data]);
  const watchlists = useResource(user ? "/watchlists/" + user.id : null);
  const watchlist = watchlists.data.find(list => list.id === watchlistId) ?? watchlists.data[0];
  const stockAdded = watchlist?.symbols?.includes(selected?.trading_symbol?.toUpperCase());
  const key = selected?.instrument_key;
  const quotes = useResource(key ? "/algo/quotes?keys="+encodeURIComponent(key) : null, {}, 5000);
  const end = new Date().toISOString().slice(0,10), start = new Date(Date.now()-period*86400000).toISOString().slice(0,10);
  const history = useResource(key ? `/algo/candles?key=${encodeURIComponent(key)}&start=${start}&end=${end}&unit=days&interval=1` : null, {});
  const quote = quotes.data.quotes?.[key], last = Number(quote?.last_price || 0), change = quote?.previous_close ? (last/quote.previous_close-1)*100 : 0;
  const holding = (portfolio.data.positions||[]).find(p=>p.instrument_key===key);
  async function action(fn) { setBusy(true); setError(""); setNotice(""); try { await fn(); } catch(e) {setError(e.message);} finally {setBusy(false);} }
  return <section className="stock-workspace" aria-label="Stock trading">
    <div className="flex-between mb-16"><div><h3 className="page-title">Stocks</h3><p className="page-subtitle">Explore the market and manage your virtual portfolio</p></div><span className="badge badge-blue">{quote?.source === "UPSTOX_REPLAY" ? "Previous session replay" : quote?.source === "UPSTOX" || quote?.source === "UPSTOX_LIVE" ? "Upstox market data" : "Demo prices"} · Paper trading</span></div>
    <Notice error={error || instruments.error || quotes.error || portfolio.error || status.error || watchlists.error}/>
    {notice && <p className="alert alert-blue" role="status">{notice}</p>}
    <div className="stock-grid">
      <Card title="Find stocks"><form className="stock-search" onSubmit={e=>{e.preventDefault();setSearch(query.trim());}}><input className="form-input" aria-label="Search stocks" placeholder="Search company or symbol" value={query} onChange={e=>setQuery(e.target.value)}/><button className="btn btn-primary" disabled={!query.trim()}>Search</button></form>
        <div className="stock-results">{(instruments.data.instruments||[]).map(s=><button type="button" key={s.instrument_key} className={"stock-result "+(s.instrument_key===key?"selected":"")} disabled={busy} onClick={()=>{setSelected(s);setError("");}}><strong>{s.trading_symbol}</strong><span>{s.name || s.exchange}</span></button>)}{!instruments.loading && !instruments.data.instruments?.length && <p>No stocks found.</p>}</div>
        <p className="card-subtitle">{status.data.hasToken?"NSE / BSE equity search":"Configure Upstox on the server for exchange market data. Demo stocks are available now."}</p>
      </Card>
      <Card title={selected?.trading_symbol || "Select a stock"} subtitle={selected?.name || "NSE / BSE equities"} actions={<strong className={change>=0?"gain":"loss"}>{money(last)} <small>{change>=0?"+":""}{change.toFixed(2)}%</small></strong>}>
        <div className="stock-periods">{[[7,"1W"],[30,"1M"],[90,"3M"],[365,"1Y"]].map(([n,label])=><button key={n} className={"btn btn-sm "+(period===n?"btn-primary":"btn-secondary")} onClick={()=>setPeriod(n)}>{label}</button>)}</div>
        <Notice error={history.error}/><PriceChart candles={history.data.candles}/>
        <p className="card-subtitle">{quote?.asof && "Quote as of "+quote.asof} · Charts show daily historical candles.</p>
        {user && watchlist && <div className="watchlist-controls">
          <div>
            <label className="form-label" htmlFor="trade-watchlist">Add to watchlist</label>
            <select className="form-select" id="trade-watchlist" disabled={busy} value={watchlist.id}
              onChange={e => setWatchlistId(e.target.value)}>
              {watchlists.data.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}
            </select>
          </div>
          <button className="btn btn-secondary btn-sm" disabled={!selected || busy || stockAdded} onClick={()=>action(async()=>{
            const list = await api(`/watchlists/${encodeURIComponent(watchlist.id)}/symbols/${encodeURIComponent(selected.trading_symbol)}`, "POST");
            watchlists.setData(current => current.map(item => item.id === list.id ? list : item));
            setNotice(`Added ${selected.trading_symbol} to ${list.name}.`);
          })}>{stockAdded ? "Already added" : "+ Add to watchlist"}</button>
        </div>}
      </Card>
      <Card title="Place an order" subtitle="Virtual funds · No broker execution">
        <div className="stock-side">
          <button className={"btn "+(side==="BUY"?"btn-green":"btn-secondary")} disabled={busy} aria-pressed={side==="BUY"} onClick={()=>setSide("BUY")}>Buy</button>
          <button className={"btn "+(side==="SELL"?"btn-primary":"btn-secondary")} disabled={busy} aria-pressed={side==="SELL"} onClick={()=>setSide("SELL")}>Sell</button>
        </div>
        <StockOrderForm key={key} id="trade" instrument={selected && {...selected, symbol: selected.trading_symbol}}
          side={side} owned={holding?.qty||0} cash={portfolio.data.cash} quote={quotes.error ? NaN : last}
          disabled={busy} onBusyChange={value=>{setBusy(value);if(value){setError("");setNotice("");}}}
          onPlaced={message=>{portfolio.reload();setNotice(message);}} />
      </Card>
    </div>
    <div className="stock-account">
      <Card title="Your holdings" subtitle={`Portfolio ${money(portfolio.data.netWorth)} · Cash ${money(portfolio.data.cash)}`}>
        <Holdings positions={portfolio.data.positions||[]}/>
      </Card>
      <Card title="Orders" subtitle="Conditional orders use sampled paper quotes."
        actions={<button className="btn btn-secondary btn-sm" disabled={busy} onClick={()=>action(async()=>{
          await api("/algo/orders/process","POST",{});portfolio.reload();setNotice("Pending orders checked against current quotes.");
        })}>Refresh orders</button>}>
        <Table heads={["Stock","Side","Quantity","Order","Prices","Status","Action"]} rows={(portfolio.data.orders||[]).map(o=>[
          o.symbol, o.side, o.qty,
          <>{orderNames[o.type]||o.type}<small className="stock-order-detail">{o.validity==="DAY"?"Today (IST)":o.type!=="MARKET"?"Till cancelled":""}</small></>,
          <OrderPrices order={o}/>,
          <>{o.status}{o.status==="PENDING" && o.triggered_at && <small className="stock-order-detail">Triggered · awaiting limit</small>}
            {o.reason && <small className="stock-order-detail">{o.reason}</small>}</>,
          o.status==="PENDING" ? <button className="btn btn-secondary btn-sm" disabled={busy} onClick={()=>action(async()=>{
            await api(`/algo/orders/${o.id}/cancel`,"POST",{});portfolio.reload();setNotice("Order cancelled.");
          })}>Cancel</button> : "—",
        ])}/>
      </Card>
    </div>
  </section>;
}

function OrderPrices({ order }) {
  const { type, trigger, limitPrice, trailPercent, stopLoss, takeProfit, fill } = order;
  return <div className="stock-order-prices">
    {fill && <strong>{fill.exitReason ? fill.exitReason + " fill" : "Filled"} {money(fill.price)}</strong>}
    {trailPercent != null && <small>Trail {trailPercent}%</small>}
    {trigger != null && <small>{type === "LIMIT" ? "Limit" : "Trigger"} {money(trigger)}</small>}
    {limitPrice != null && <small>Limit {money(limitPrice)}</small>}
    {stopLoss != null && <small>Stop-loss {money(stopLoss)}</small>}
    {takeProfit != null && <small>Take-profit {money(takeProfit)}</small>}
    {!fill && trigger == null && trailPercent == null && stopLoss == null && takeProfit == null && "—"}
  </div>;
}
