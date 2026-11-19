import { create } from "zustand";

/** Whether the cart drawer is open (shared by the header button and the floating cart bar). */
export const useCartUi = create<{ open: boolean; setOpen: (open: boolean) => void }>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
