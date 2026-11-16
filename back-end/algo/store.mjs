import {AsyncLocalStorage} from 'node:async_hooks';
const context=new AsyncLocalStorage();
export const withUser=(id,fn)=>context.run(id,fn);
const accounts=new Map();
const account=()=>{const id=context.getStore();if(!id)throw Error('Authenticated research account required');if(!accounts.has(id))accounts.set(id,{id,db:null});return accounts.get(id);};
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const DB=()=>path.resolve(process.env.DATA_DIR||path.join(process.cwd(),'persistent-data'),'research',account().id+'.json');
const starting=()=>({version:2,startingCash:Number(process.env.INITIAL_PAPER_CASH||100000),cash:Number(process.env.INITIAL_PAPER_CASH||100000),positions:{},orders:[],bots:[],activity:[],equityHistory:[]});

export function initDB(){fs.mkdirSync(path.dirname(DB()),{recursive:true});if(fs.existsSync(DB())){try{account().db=JSON.parse(fs.readFileSync(DB(),'utf8'));if(!Number.isFinite(account().db.cash)||!account().db.positions||!Array.isArray(account().db.orders)||!Array.isArray(account().db.bots))throw Error('invalid data');}catch(e){throw Error('Cannot load saved virtual account at data/paper.json. Restore a valid backup or rename the corrupt file. '+e.message);}}else {account().db=starting();persist();}return account().db;}
export const data=()=>account().db??initDB();
export function persist(){fs.mkdirSync(path.dirname(DB()),{recursive:true});const tmp=DB()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(account().db,null,2),'utf8');fs.renameSync(tmp,DB());}
export function mutate(fn){const result=fn(data());persist();return result;}
export function reset(){account().db=starting();persist();return account().db;}
export const uuid=()=>crypto.randomUUID();
export function markPortfolio(prices={},record=true){
 const d=data();
 const positions=Object.values(d.positions).map(p=>{
  const quote=Number(prices[p.instrument_key]?.last_price);
  if(quote>0)p.last_price=quote;
  const ltp=p.last_price||p.avg_price;
  return {...p,ltp,market_value:money(p.qty*ltp),unrealized:money((ltp-p.avg_price)*p.qty)};
 });
 const holdings=money(positions.reduce((sum,p)=>sum+p.market_value,0)),netWorth=money(d.cash+holdings);
 d.equityHistory=d.equityHistory||[];
 const complete=positions.every(p=>Number(prices[p.instrument_key]?.last_price)>0);
 if(record && (complete||positions.length===0)){
  const previous=d.equityHistory.at(-1),now=new Date().toISOString();
  if(!previous||previous.netWorth!==netWorth||previous.cash!==d.cash||Date.now()-Date.parse(previous.at)>=60000){
   d.equityHistory.push({at:now,netWorth,cash:d.cash,holdings});
   d.equityHistory=d.equityHistory.slice(-10000);persist();
  }
 }
 return {cash:d.cash,startingCash:d.startingCash,holdings,netWorth,positions,equityHistory:d.equityHistory,orders:d.orders.filter((o, i) => o.status === 'PENDING' || i >= d.orders.length - 100).reverse(),bots:d.bots,activity:d.activity.slice(-10).reverse()};
}
function money(v){return Math.round((v+Number.EPSILON)*100)/100;}
const orderDate = new Intl.DateTimeFormat('en-CA', {
 timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
});
const positive = price => Number.isFinite(price) && price >= 0.01;

export function createOrder(spec) {
 const {key, symbol, exchange, side, type, qty, trigger, limitPrice, trailPercent,
  stopLoss, takeProfit, validity = 'GTC', policy = {}} = spec;
 if (!key || !symbol || !['BUY', 'SELL'].includes(side) ||
     !['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT', 'TRAILING_STOP'].includes(type) ||
     !Number.isInteger(qty) || qty < 1 || qty > 10000000) {
  throw Error('Check order instrument, type, side and whole-share quantity.');
 }
 if (!['GTC', 'DAY'].includes(validity)) throw Error('Choose a valid order duration.');
 if (['LIMIT', 'STOP', 'STOP_LIMIT'].includes(type) && !positive(trigger)) {
  throw Error('Set a limit or stop trigger price of at least ₹0.01.');
 }
 if (type === 'STOP_LIMIT' && (!positive(limitPrice) || (side === 'BUY' ? limitPrice < trigger : limitPrice > trigger))) {
  throw Error('A stop-limit needs a positive limit at or above the buy trigger, or at or below the sell trigger.');
 }
 if (type === 'TRAILING_STOP' && (side !== 'SELL' || !Number.isFinite(trailPercent) || trailPercent < 0.01 || trailPercent >= 100)) {
  throw Error('Trailing stops require a sell order and a trailing percentage from 0.01 to 99.99.');
 }
 if (stopLoss != null || takeProfit != null) {
  if (side !== 'BUY' || (stopLoss != null && !positive(stopLoss)) || (takeProfit != null && !positive(takeProfit))) {
   throw Error('Attached exits require a buy order and prices of at least ₹0.01.');
  }
  if (stopLoss != null && takeProfit != null && stopLoss >= takeProfit) {
   throw Error('The stop-loss price must be below the take-profit price.');
  }
 }
 const d = data();
 if (side === 'SELL' && (d.positions[key]?.qty || 0) < qty) throw Error('Insufficient paper holdings for a sell order.');
 const manualOrders = d.orders.filter(o => !o.parentId);
 const now = new Date();
 if (policy.maxDailyTrades > 0 && manualOrders.filter(o =>
  o.status !== 'REJECTED' && orderDate.format(new Date(o.created_at)) === orderDate.format(now)
 ).length >= policy.maxDailyTrades) throw Error('Daily order limit reached.');
 const last = manualOrders.at(-1);
 if (last && policy.cooldown > 0 && now - Date.parse(last.created_at) < policy.cooldown * 1000) {
  throw Error('Please wait for the configured order cooldown.');
 }
 return mutate(d => {
  const order = {
   id: uuid(), instrument_key: key, symbol, exchange, side, type, qty, validity,
   trigger: ['MARKET', 'TRAILING_STOP'].includes(type) ? null : trigger,
   ...(type === 'STOP_LIMIT' && {limitPrice}),
   ...(type === 'TRAILING_STOP' && {trailPercent}),
   ...(stopLoss != null && {stopLoss}),
   ...(takeProfit != null && {takeProfit}),
   status: 'PENDING', created_at: now.toISOString(), maxOrderValue: policy.tradingLimit || null,
   fill: null, reason: null,
  };
  d.orders.push(order);
  return order;
 });
}

export function cancelOrder(id) {
 return mutate(d => {
  const order = d.orders.find(o => o.id === id);
  if (!order || order.status !== 'PENDING') throw Error('Pending order not found.');
  order.status = 'CANCELLED';
  return order;
 });
}

function reject(order, reason) {
 order.status = 'REJECTED';
 order.reason = reason;
 return order;
}

function addExit(d, entry) {
 const {instrument_key, symbol, exchange, qty, stopLoss, takeProfit} = entry;
 d.orders.push({
  id: uuid(), parentId: entry.id, instrument_key, symbol, exchange, qty, stopLoss, takeProfit,
  side: 'SELL', type: 'PROTECTION', validity: 'GTC', status: 'PENDING',
  created_at: entry.fill.at, fill: null, reason: null,
 });
}

function resizeExits(d, key, available) {
 for (const exit of d.orders) {
  if (!exit.parentId || exit.status !== 'PENDING' || exit.instrument_key !== key) continue;
  if (available === 0) {
   exit.status = 'CANCELLED';
   exit.reason = 'The covered shares were sold.';
   continue;
  }
  exit.qty = Math.min(exit.qty, available);
  available -= exit.qty;
 }
}

export function expireOrder(id, now = new Date()) {
 const order = data().orders.find(o => o.id === id);
 if (order?.status !== 'PENDING' || order.validity !== 'DAY' ||
     orderDate.format(new Date(order.created_at)) === orderDate.format(now)) return null;
 return mutate(() => {
  order.status = 'EXPIRED';
  order.reason = 'Order validity ended at midnight IST.';
  return order;
 });
}

export function settleOrder(id, quote, slippagePct = 0.03, now = new Date()) {
 const expired = expireOrder(id, now);
 if (expired) return expired;
 const d = data();
 const order = d.orders.find(o => o.id === id);
 const price = Number(quote?.last_price);
 if (order?.status !== 'PENDING' || !Number.isFinite(price) || price <= 0) return null;

 const buying = order.side === 'BUY';
 const stopCrossed = buying ? price >= order.trigger : price <= order.trigger;
 let limit = null;
 let exitReason = null;
 switch (order.type) {
  case 'LIMIT':
   limit = order.trigger;
   break;
  case 'STOP':
   if (!stopCrossed) return null;
   break;
  case 'STOP_LIMIT':
   if (!order.triggered_at) {
    if (!stopCrossed) return null;
    order.triggered_at = now.toISOString();
    persist();
   }
   limit = order.limitPrice;
   break;
  case 'TRAILING_STOP': {
   if (!order.highWaterPrice || price > order.highWaterPrice) {
    order.highWaterPrice = price;
    order.trigger = price * (1 - order.trailPercent / 100);
    persist();
   }
   if (price > order.trigger) return null;
   break;
  }
  case 'PROTECTION':
   if (order.stopLoss != null && price <= order.stopLoss) {
    exitReason = 'Stop-loss';
   } else if (order.takeProfit != null && price >= order.takeProfit) {
    exitReason = 'Take-profit';
    limit = order.takeProfit;
   } else return null;
   break;
 }
 if (limit != null && (buying ? price > limit : price < limit)) return null;

 const slipped = price * (1 + (buying ? 1 : -1) * slippagePct / 100);
 const executionPrice = money(limit == null ? slipped : buying ? Math.min(limit, slipped) : Math.max(limit, slipped));
 const total = money(executionPrice * order.qty);
 const key = order.instrument_key;
 const position = d.positions[key];
 return mutate(d => {
  if (buying) {
   if (order.maxOrderValue && total > order.maxOrderValue) return reject(order, 'Order exceeds your configured trading limit.');
   if (d.cash < total) return reject(order, 'Insufficient virtual buying power at fill.');
   if ((order.stopLoss != null && executionPrice <= order.stopLoss) ||
       (order.takeProfit != null && executionPrice >= order.takeProfit)) {
    return reject(order, 'Entry price reached an attached exit. Set stop-loss below and take-profit above the entry price.');
   }
   d.cash = money(d.cash - total);
   const oldQty = position?.qty || 0;
   const qty = oldQty + order.qty;
   const avg = (oldQty * (position?.avg_price || 0) + total) / qty;
   d.positions[key] = {instrument_key: key, symbol: order.symbol, exchange: order.exchange, qty, avg_price: money(avg)};
  } else {
   if (!position || position.qty < order.qty) return reject(order, 'Insufficient virtual holdings at fill.');
   d.cash = money(d.cash + total);
   position.qty -= order.qty;
   if (position.qty === 0) delete d.positions[key];
  }
  order.status = 'FILLED';
  order.fill = {price: executionPrice, at: new Date().toISOString(), source: quote.source};
  if (exitReason) order.fill.exitReason = exitReason;
  if (buying && (order.stopLoss != null || order.takeProfit != null)) addExit(d, order);
  if (!buying) resizeExits(d, key, position.qty);
  d.activity.push({id: order.id, action: order.side, qty: order.qty, symbol: order.symbol, price: executionPrice, at: order.fill.at});
  return order;
 });
}
export function createBot(spec){const {key,symbol,exchange,strategy,qty,params}=spec;if(!key||!symbol||!Number.isInteger(qty)||qty<1||qty>1000000)throw Error('Invalid bot instrument or quantity.');if(!['sma','ema','rsi','bollinger','breakout','momentum','rules'].includes(strategy))throw Error('Invalid bot strategy.');return mutate(d=>{const b={id:uuid(),instrument_key:key,symbol,exchange,strategy,qty,params:params||{},enabled:false,last_signal_date:null,last_action:null,created_at:new Date().toISOString()};d.bots.push(b);return b;});}
export function updateBot(id,enabled){return mutate(d=>{const b=d.bots.find(x=>x.id===id);if(!b)throw Error('Bot not found');b.enabled=Boolean(enabled);return b;});}
export function markBot(id,when,action){return mutate(d=>{const b=d.bots.find(x=>x.id===id);if(b){b.last_signal_date=when;b.last_action=action;}return b;});}
