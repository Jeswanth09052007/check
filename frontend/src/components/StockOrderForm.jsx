import { useRef, useState } from "react";
import { api, money } from "../services/api";
import { Notice } from "./Common";

export const orderNames = {
  MARKET: "Market",
  LIMIT: "Limit",
  STOP: "Stop market",
  STOP_LIMIT: "Stop limit",
  TRAILING_STOP: "Trailing stop",
  PROTECTION: "Attached exit",
};

const orderHints = {
  MARKET: "Uses the next available quote. The fill price may differ.",
  LIMIT: "Fills at your limit price or better.",
  STOP: "Becomes a market order when the trigger is reached.",
  STOP_LIMIT: "Becomes a limit order when the trigger is reached.",
  TRAILING_STOP: "The trigger follows the highest observed quote and stays put when the price falls.",
};

function PriceInput({ id, label, value, onChange, required = false }) {
  return <div>
    <label className="form-label" htmlFor={id}>{label}</label>
    <input id={id} className="form-input" type="number" min="0.01" step="0.01"
      value={value} onChange={e => onChange(e.target.value)} required={required} />
  </div>;
}

export default function StockOrderForm({
  id, instrument, side, owned, cash, quote, disabled, onBusyChange, onPlaced,
}) {
  const [quantity, setQuantity] = useState("1");
  const [selectedType, setType] = useState("MARKET");
  const [price, setPrice] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [trailPercent, setTrailPercent] = useState("");
  const [validity, setValidity] = useState("GTC");
  const [attachExits, setAttachExits] = useState(false);
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const selling = side === "SELL";
  const type = !selling && selectedType === "TRAILING_STOP" ? "MARKET" : selectedType;
  const hasPrice = ["LIMIT", "STOP", "STOP_LIMIT"].includes(type);
  const maxQuantity = selling ? Math.min(owned, 10000000) : 10000000;
  const quoteAvailable = Number.isFinite(quote) && quote > 0;
  const estimatePrice = type === "STOP_LIMIT" ? Number(limitPrice) : hasPrice ? Number(price) : quote;
  const estimated = estimatePrice > 0 && Number(quantity) > 0 ? estimatePrice * Number(quantity) : null;
  const showExits = !selling && attachExits;

  async function submit(event) {
    event.preventDefault();
    if (submitting.current || disabled || !instrument || !quoteAvailable) return;
    setError("");
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > maxQuantity) {
      setError(selling ? "Enter a whole-share quantity within your holdings." : "Enter a positive whole-share quantity.");
      return;
    }
    if (!selling && type !== "STOP" && Number.isFinite(cash) && estimated > cash) {
      setError("Insufficient virtual balance.");
      return;
    }
    if (type === "STOP_LIMIT" && (selling ? Number(limitPrice) > Number(price) : Number(limitPrice) < Number(price))) {
      setError(selling ? "Set the sell limit at or below the trigger." : "Set the buy limit at or above the trigger.");
      return;
    }
    if (showExits && !stopLoss && !takeProfit) {
      setError("Enter a stop-loss or take-profit price.");
      return;
    }
    if (showExits && stopLoss && takeProfit && Number(stopLoss) >= Number(takeProfit)) {
      setError("Set the stop-loss below the take-profit price.");
      return;
    }
    if (showExits && type === "MARKET" && ((stopLoss && Number(stopLoss) >= quote) || (takeProfit && Number(takeProfit) <= quote))) {
      setError("For a market buy, set the stop-loss below and the take-profit above the current quote.");
      return;
    }

    submitting.current = true;
    onBusyChange(true);
    try {
      const { order, warning } = await api("/algo/orders", "POST", {
        key: instrument.instrument_key, symbol: instrument.symbol, exchange: instrument.exchange,
        side, type, qty, validity: type === "MARKET" ? "GTC" : validity,
        trigger: hasPrice ? Number(price) : undefined,
        limitPrice: type === "STOP_LIMIT" ? Number(limitPrice) : undefined,
        trailPercent: type === "TRAILING_STOP" ? Number(trailPercent) : undefined,
        stopLoss: showExits && stopLoss ? Number(stopLoss) : undefined,
        takeProfit: showExits && takeProfit ? Number(takeProfit) : undefined,
      });
      const details = [order.reason, warning].filter(Boolean).join(" · ");
      onPlaced(`${side} ${order.qty} ${order.symbol}: ${order.status}${details ? " — " + details : ""}`);
    } catch (e) {
      setError(e.message);
    } finally {
      submitting.current = false;
      onBusyChange(false);
    }
  }

  return <form onSubmit={submit} className="stock-ticket">
    <Notice error={error} />
    <fieldset disabled={disabled} className="stock-ticket-fields">
      <div>
        <label className="form-label" htmlFor={id + "-quantity"}>Quantity</label>
        <input id={id + "-quantity"} className="form-input" type="number" min="1" max={maxQuantity} step="1"
          required value={quantity} onChange={e => setQuantity(e.target.value)} />
      </div>
      <div>
        <label className="form-label" htmlFor={id + "-type"}>Order type</label>
        <select id={id + "-type"} className="form-select" value={type} onChange={e => {
          setType(e.target.value);
          setPrice("");
          setLimitPrice("");
          setError("");
        }}>
          {["MARKET", "LIMIT", "STOP", "STOP_LIMIT", ...(selling ? ["TRAILING_STOP"] : [])].map(value =>
            <option value={value} key={value}>{orderNames[value]}</option>)}
        </select>
        <p className="card-subtitle stock-ticket-hint">{orderHints[type]}</p>
      </div>
      {hasPrice && <PriceInput id={id + "-price"} label={type === "LIMIT" ? "Limit price" : "Trigger price"}
        value={price} onChange={setPrice} required />}
      {type === "STOP_LIMIT" && <PriceInput id={id + "-limit"} label="Limit price"
        value={limitPrice} onChange={setLimitPrice} required />}
      {type === "TRAILING_STOP" && <div>
        <label className="form-label" htmlFor={id + "-trail"}>Trailing distance (%)</label>
        <input id={id + "-trail"} className="form-input" type="number" min="0.01" max="99.99" step="0.01"
          value={trailPercent} onChange={e => setTrailPercent(e.target.value)} required />
      </div>}
      {type !== "MARKET" && <div>
        <label className="form-label" htmlFor={id + "-validity"}>Time in force</label>
        <select id={id + "-validity"} className="form-select" value={validity} onChange={e => setValidity(e.target.value)}>
          <option value="GTC">Good till cancelled</option>
          <option value="DAY">Today · until midnight IST</option>
        </select>
      </div>}
      {!selling && <label className="stock-exits-toggle">
        <input type="checkbox" checked={attachExits} onChange={e => setAttachExits(e.target.checked)} />
        Attach stop-loss or take-profit
      </label>}
      {showExits && <div className="stock-exits">
        <PriceInput id={id + "-stop-loss"} label="Stop-loss price" value={stopLoss} onChange={setStopLoss} />
        <PriceInput id={id + "-take-profit"} label="Take-profit price" value={takeProfit} onChange={setTakeProfit} />
        <p className="card-subtitle">Set either price or both. The exit starts after the buy fills and stays active until one price is reached or you cancel it.</p>
      </div>}
    </fieldset>
    <div className="stock-summary">
      <p>Available balance <strong>{Number.isFinite(cash) ? money(cash) : "—"}</strong></p>
      <p>Owned shares <strong>{owned}</strong></p>
      <p>Quote per share <strong>{quoteAvailable ? money(quote) : "—"}</strong></p>
      <p>Estimated value <strong>{estimated === null ? "—" : money(estimated)}</strong></p>
    </div>
    <button className={`btn ${selling ? "btn-primary" : "btn-green"}`}
      disabled={disabled || !quoteAvailable || !instrument || maxQuantity < 1}>
      {disabled && submitting.current ? "Placing…" : `Place virtual ${side}`}
    </button>
  </form>;
}
