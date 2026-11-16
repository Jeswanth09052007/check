import { useRef, useState } from "react";
import { useResource } from "../hooks/useResource";
import { api, money } from "../services/api";
import { Card, Editor, Empty, Modal, Notice, Table } from "./Common";

const nameFields = [{ name: "name", label: "Watchlist name", minLength: 3, maxLength: 60 }];

export default function Watchlists({ user, notify, onTrade }) {
  const resource = useResource("/watchlists/" + user.id);
  const stocks = useResource("/stocks");
  const [listId, setListId] = useState("");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const lists = resource.data;
  const selected = lists.find(list => list.id === listId) ?? lists[0];
  const dialogList = lists.find(list => list.id === dialog?.listId);
  const symbols = selected?.symbols ?? [];
  const listPath = selected ? "/watchlists/" + encodeURIComponent(selected.id) : null;
  const query = search.trim().toLowerCase();
  const matches = query ? stocks.data.filter(stock =>
    (stock.symbol + " " + stock.name).toLowerCase().includes(query)
  ).slice(0, 12) : [];

  async function mutate(task) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await task();
      resource.reload();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function storeList(list) {
    resource.setData(current => current.some(item => item.id === list.id)
      ? current.map(item => item.id === list.id ? list : item)
      : [...current, list]);
  }

  async function saveName({ name }) {
    await mutate(async () => {
      const creating = dialog.action === "create";
      const list = await api(creating ? "/watchlists/" + user.id : "/watchlists/" + encodeURIComponent(dialog.listId),
        creating ? "POST" : "PATCH", { name });
      storeList(list);
      setListId(list.id);
      setDialog(null);
      notify(creating ? "Watchlist created." : "Watchlist renamed.");
    });
  }

  async function changeSymbol(symbol, method) {
    await mutate(async () => {
      const list = await api(listPath + "/symbols/" + encodeURIComponent(symbol), method);
      storeList(list);
      if (method === "POST") setSearch("");
    }).catch(e => setError(e.message));
  }

  async function deleteList() {
    await mutate(async () => {
      await api("/watchlists/" + encodeURIComponent(dialog.listId), "DELETE");
      resource.setData(current => current.filter(item => item.id !== dialog.listId));
      setListId("");
      setDialog(null);
      notify("Watchlist deleted.");
    }).catch(e => setError(e.message));
  }

  function openDialog(action) {
    setError("");
    setDialog({ action, listId: action === "create" ? null : selected.id });
  }

  return <>
    <div className="flex-between mb-16">
      <h3 className="page-title">Watchlists</h3>
      <button className="btn btn-primary" disabled={busy || resource.loading} onClick={() => openDialog("create")}>
        + New watchlist
      </button>
    </div>
    <Notice error={(dialog?.action === "delete" ? "" : error) || resource.error || stocks.error} />
    <Card title={selected?.name ?? "Your watchlists"} subtitle={selected ? `${symbols.length} stocks` : undefined}>
      {selected && <>
        <div className="watchlist-controls mb-16">
          <div>
            <label className="form-label" htmlFor="watchlist-select">Watchlist</label>
            <select className="form-select" id="watchlist-select" value={selected.id} disabled={busy}
              onChange={e => { setListId(e.target.value); setError(""); }}>
              {lists.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}
            </select>
          </div>
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => openDialog("rename")}>Rename</button>
          <button className="btn btn-secondary btn-sm" disabled={busy || lists.length < 2}
            title={lists.length < 2 ? "Keep at least one watchlist" : undefined}
            onClick={() => openDialog("delete")}>Delete watchlist</button>
        </div>
        <label className="form-label" htmlFor="watchlist-search">Search watchlist stocks</label>
        <input className="form-input mb-16" id="watchlist-search" placeholder="Search to add a stock…"
          value={search} onChange={e => setSearch(e.target.value)} />
        {query && <div className="watchlist-controls mb-16" aria-label="Stock search results">
          {matches.length ? matches.map(stock => {
            const added = symbols.includes(stock.symbol);
            return <button className="btn btn-secondary btn-sm" key={stock.symbol} disabled={busy || added}
              onClick={() => changeSymbol(stock.symbol, "POST")}>
              {added ? stock.symbol + " added" : "+ " + stock.symbol}
            </button>;
          }) : <p className="card-subtitle">No matching stocks found.</p>}
        </div>}
        {symbols.length ? <Table heads={["Symbol", "Company", "Price", "Action"]} rows={symbols.map(symbol => {
          const stock = stocks.data.find(item => item.symbol === symbol);
          return [
            symbol, stock?.name ?? "—", stock?.price == null ? "—" : money(stock.price),
            <div className="watchlist-controls">
              <button className="btn btn-primary btn-sm" onClick={() => onTrade(symbol)}>Trade</button>
              <button className="btn btn-secondary btn-sm" disabled={busy}
                onClick={() => changeSymbol(symbol, "DELETE")}>Remove</button>
            </div>,
          ];
        })} /> : <Empty>Search above to add stocks to this watchlist.</Empty>}
        <p className="card-subtitle">Watchlist prices use the bundled demonstration feed. The Trading workspace shows market and replay data.</p>
      </>}
      {!selected && <Empty>{resource.loading ? "Loading watchlists…" : "Create a watchlist to start tracking stocks."}</Empty>}
    </Card>
    {(dialog?.action === "create" || (dialog?.action === "rename" && dialogList)) && (
      <Modal title={dialog?.action === "create" ? "New watchlist" : "Rename watchlist"}
        onClose={() => { if (!pending.current) setDialog(null); }}>
        <Editor fields={nameFields} initial={{ name: dialog?.action === "rename" ? dialogList.name : "" }}
          onSubmit={saveName} submit={dialog?.action === "create" ? "Create watchlist" : "Save name"} />
      </Modal>
    )}
    {dialog?.action === "delete" && dialogList && (
      <Modal title="Delete watchlist" onClose={() => { if (!pending.current) setDialog(null); }}>
        <p className="mb-16">Delete “{dialogList.name}” and its saved stocks?</p>
        <Notice error={error} />
        <button className="btn btn-primary" disabled={busy} onClick={deleteList}>Delete watchlist</button>
      </Modal>
    )}
  </>;
}
