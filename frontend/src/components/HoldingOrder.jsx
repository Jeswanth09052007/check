import { useState } from "react";
import { useResource } from "../hooks/useResource";
import { Modal, Notice } from "./Common";
import StockOrderForm from "./StockOrderForm";
import "../styles/trading.css";

export default function HoldingOrder({ position, side, owned, cash, onClose, onPlaced }) {
  const { instrument_key: key, symbol, exchange } = position;
  const quote = useResource("/algo/quotes?keys=" + encodeURIComponent(key), {}, 5000);
  const [busy, setBusy] = useState(false);
  const action = side === "SELL" ? "Sell" : "Buy";
  const price = quote.error ? NaN : Number(quote.data.quotes?.[key]?.last_price);
  const quoteAvailable = Number.isFinite(price) && price > 0;

  return (
    <Modal title={`${action} ${symbol}`} onClose={() => { if (!busy) onClose(); }}>
      <p className="card-subtitle mb-16">Paper order{exchange ? ` · ${exchange}` : ""}</p>
      <Notice error={quote.error || (!quote.loading && !quoteAvailable ? "No quote is available for this stock." : "")} />
      <StockOrderForm id="holding-order" instrument={position} side={side} owned={owned} cash={cash}
        quote={price} disabled={busy} onBusyChange={setBusy} onPlaced={onPlaced} />
    </Modal>
  );
}
