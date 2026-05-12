import { Injectable } from '@angular/core';

const STORAGE_KEY = 'ipl_sim_user_id';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly _userId: string;

  constructor() {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      this._userId = existing;
    } else {
      this._userId = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, this._userId);
    }
  }

  userId(): string {
    return this._userId;
  }
}
