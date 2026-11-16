import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {cancelOrder, createOrder, initDB, markPortfolio, reset, settleOrder, withUser} from '../back-end/algo/store.mjs';
import {routes} from '../back-end/algo/server.mjs';

const stock = {key: 'DEMO|RELIANCE', symbol: 'RELIANCE', exchange: 'DEMO'};
const quote = last_price => ({last_price, source: 'SYNTHETIC'});
function paperAccount(run) {
 return async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'indai-paper-orders-'));
  process.env.DATA_DIR = dir;
  try {
   await withUser('paper-order-tests', () => {
    reset();
    return run();
   });
  } finally {
   rmSync(dir, {recursive: true, force: true});
   delete process.env.DATA_DIR;
  }
 };
}
const buy = options => createOrder({...stock, side: 'BUY', type: 'MARKET', qty: 1, ...options});
const sell = options => createOrder({...stock, side: 'SELL', type: 'MARKET', qty: 1, ...options});
const fillAt = (order, price) => settleOrder(order.id, quote(price), 0);

test('A stop-limit remembers its trigger after a gap and restart and respects its limit', paperAccount(() => {
 assert.throws(() => buy({type: 'STOP_LIMIT', trigger: 100, limitPrice: 99}), /stop-limit/i);
 const order = buy({type: 'STOP_LIMIT', trigger: 100, limitPrice: 102});
 assert.equal(fillAt(order, 99), null);
 assert.equal(fillAt(order, 104), null);
 initDB();
 assert.ok(markPortfolio().orders[0].triggered_at);
 assert.equal(fillAt(order, 98).fill.price, 98);
 assert.equal(fillAt(order, 98), null);
 assert.equal(markPortfolio().positions[0].qty, 1);
}));

test('A trailing sell stop ratchets upward and fills at the next observed gap price', paperAccount(() => {
 fillAt(buy(), 100);
 const order = sell({type: 'TRAILING_STOP', trailPercent: 10});
 assert.equal(fillAt(order, 100), null);
 assert.equal(fillAt(order, 120), null);
 assert.equal(fillAt(order, 109), null);
 assert.equal(markPortfolio().orders[0].trigger, 108);
 initDB();
 assert.equal(fillAt(order, 103).fill.price, 103);
 assert.equal(markPortfolio().positions.length, 0);
}));

test('Attached exits activate on fill, follow the covered quantity and execute only once', paperAccount(() => {
 const entry = buy({type: 'LIMIT', trigger: 100, qty: 3, stopLoss: 90, takeProfit: 110});
 assert.equal(fillAt(entry, 101), null);
 assert.equal(markPortfolio().orders.length, 1);
 fillAt(entry, 100);
 let exit = markPortfolio().orders[0];
 assert.equal(exit.parentId, entry.id);
 fillAt(sell(), 105);
 exit = markPortfolio().orders.find(order => order.id === exit.id);
 assert.equal(exit.qty, 2);
 assert.equal(fillAt(exit, 105), null);
 assert.equal(fillAt(exit, 115).fill.exitReason, 'Take-profit');
 assert.equal(fillAt(exit, 85), null);
 assert.equal(markPortfolio().positions.length, 0);

 const stopped = buy({stopLoss: 90, takeProfit: 110});
 fillAt(stopped, 100);
 assert.equal(fillAt(markPortfolio().orders[0], 85).fill.exitReason, 'Stop-loss');
 const impossible = buy({stopLoss: 90});
 assert.equal(fillAt(impossible, 85).status, 'REJECTED');
 assert.equal(markPortfolio().positions.length, 0);
}));

test('Manual closes cancel uncovered exits and pending exits can also be cancelled directly', paperAccount(() => {
 fillAt(buy({stopLoss: 90}), 100);
 const exit = markPortfolio().orders[0];
 fillAt(sell(), 100);
 assert.equal(markPortfolio().orders.find(order => order.id === exit.id).status, 'CANCELLED');
 fillAt(buy({takeProfit: 110}), 100);
 const next = markPortfolio().orders[0];
 assert.equal(cancelOrder(next.id).status, 'CANCELLED');
 assert.equal(fillAt(next, 120), null);
 assert.equal(markPortfolio().positions[0].qty, 1);
}));

test('Today orders expire at midnight IST even without a quote and GTC orders continue', paperAccount(() => {
 const day = buy({type: 'LIMIT', trigger: 100, validity: 'DAY'});
 const gtc = buy({type: 'LIMIT', trigger: 100});
 day.created_at = gtc.created_at = '2026-10-05T18:00:00Z';
 assert.equal(settleOrder(day.id, null, 0, new Date('2026-10-05T18:29:59Z')), null);
 assert.equal(settleOrder(day.id, null, 0, new Date('2026-10-05T18:30:00Z')).status, 'EXPIRED');
 assert.equal(settleOrder(gtc.id, quote(100), 0, new Date('2026-10-05T18:30:00Z')).status, 'FILLED');
}));

test('The order API accepts both exits, exposes them in the portfolio, and rejects bad inputs', paperAccount(async () => {
 const params = new URLSearchParams();
 const spec = {...stock, side: 'BUY', type: 'MARKET', qty: 1};
 await assert.rejects(routes('POST', '/api/orders', params, {...spec, stopLoss: ''}), /Attached exits/);
 await assert.rejects(routes('POST', '/api/orders', params, {...spec, validity: 'IOC'}), /duration/);
 const {order} = await routes('POST', '/api/orders', params, {...spec, stopLoss: '0.01', takeProfit: 1000000});
 assert.equal(order.status, 'FILLED');
 const portfolio = await routes('GET', '/api/portfolio', params, {});
 const exit = portfolio.orders.find(item => item.parentId === order.id);
 assert.equal(exit.stopLoss, 0.01);
 assert.equal(exit.takeProfit, 1000000);
 const cancelled = await routes('POST', `/api/orders/${exit.id}/cancel`, params, {});
 assert.equal(cancelled.order.status, 'CANCELLED');
}));
