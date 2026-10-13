import { create } from 'zustand';

const ACTIVE_ACCOUNT_KEY = 'tsinjo_active_account';

interface ActiveAccountStore {
  activeAccountId: string | null;
  setActiveAccountId: (id: string | null) => void;
}

export const useActiveAccountStore = create<ActiveAccountStore>((set) => ({
  activeAccountId: localStorage.getItem(ACTIVE_ACCOUNT_KEY),
  setActiveAccountId: (id) => {
    if (id) {
      localStorage.setItem(ACTIVE_ACCOUNT_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
    }
    set({ activeAccountId: id });
  },
}));
