import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SYMBOL_REGEX } from '../../common/validation.constants';
import { DataStore } from '../../store/data.store';
import { CreateWatchlistDto, UpdateWatchlistDto } from './dto';

@Injectable()
export class WatchlistsService {
  constructor(private readonly db: DataStore) {}

  list(userId: string) {
    if (!this.db.getUser(userId)) throw new NotFoundException('User not found.');
    const rows = this.db.watchlists.filter(w => w.userId === userId);
    if (rows.length) return rows;

    const starter = {
      id: this.db.id('wl'), userId, name: 'My Watchlist', active: true,
      symbols: ['TCS', 'RELIANCE', 'INFY'],
    };
    this.db.watchlists.push(starter);
    this.db.save();
    return [starter];
  }

  create(userId: string, body: CreateWatchlistDto) {
    if (!this.db.getUser(userId)) throw new NotFoundException('User not found.');
    const name = body.name == null
      ? 'New Watchlist'
      : this.validateName(userId, body.name);
    const symbols = this.validateSymbols(body.symbols ?? []);
    const list = { id: this.db.id('wl'), userId, name, active: false, symbols };
    this.db.watchlists.push(list);
    return list;
  }

  update(id: string, body: UpdateWatchlistDto) {
    const list = this.getList(id);
    const name = body.name == null ? list.name : this.validateName(list.userId, body.name, id);
    const symbols = body.symbols == null ? list.symbols : this.validateSymbols(body.symbols);
    Object.assign(list, { name, symbols });
    return list;
  }

  addSymbol(id: string, symbol: string) {
    const list = this.getList(id);
    const [normalized] = this.validateSymbols([symbol]);
    if ((list.symbols ?? []).includes(normalized)) throw new ConflictException('Symbol already exists in watchlist.');
    list.symbols = [...(list.symbols ?? []), normalized];
    return list;
  }

  removeSymbol(id: string, symbol: string) {
    const list = this.getList(id);
    list.symbols = (list.symbols ?? []).filter(s => s !== symbol.toUpperCase());
    return list;
  }

  remove(id: string) {
    const list = this.getList(id);
    if (!this.db.watchlists.some(w => w.userId === list.userId && w.id !== id)) {
      throw new BadRequestException('Keep at least one watchlist.');
    }
    this.db.watchlists.splice(this.db.watchlists.indexOf(list), 1);
    return { id };
  }

  private getList(id: string) {
    const list = this.db.watchlists.find(w => w.id === id);
    if (!list) throw new NotFoundException('Watchlist not found.');
    return list;
  }

  private validateName(userId: string, raw: string, excludedId?: string) {
    const name = raw.trim();
    if (name.length < 3 || name.length > 60) {
      throw new BadRequestException('Watchlist names must be between 3 and 60 characters.');
    }
    if (this.db.watchlists.some(w => w.userId === userId && w.id !== excludedId &&
      w.name.trim().toLowerCase() === name.toLowerCase())) {
      throw new ConflictException('You already have a watchlist with that name.');
    }
    return name;
  }

  private validateSymbols(symbols: string[]) {
    const normalized = [...new Set(symbols.map(s => s.toUpperCase()))];
    for (const symbol of normalized) {
      if (!SYMBOL_REGEX.test(symbol)) throw new BadRequestException('Invalid stock symbol.');
      if (!this.db.stocks.some(s => s.symbol === symbol) && !this.db.getStock(symbol)) {
        throw new NotFoundException('Stock symbol not found.');
      }
    }
    return normalized;
  }
}
