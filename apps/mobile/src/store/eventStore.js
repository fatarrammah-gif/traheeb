/**
 * Event store — API-backed via /api/events.
 * Zustand holds a local cache; individual screens use TanStack Query for fetching.
 */
import { create } from "zustand";
import fetchToWeb from "@/__create/fetch";

const useEventStore = create((set, get) => ({
  events: [],

  // ── Fetch ──────────────────────────────────────────────────────────────────

  fetchEvents: async () => {
    const res = await fetchToWeb("/api/events");
    if (!res.ok) throw new Error("فشل تحميل الفعاليات");
    const { events } = await res.json();
    // Preserve guests arrays already loaded by fetchEventDetail
    set((state) => ({
      events: events.map((e) => {
        const cached = state.events.find((c) => c.id === e.id);
        return cached?.guests ? { ...e, guests: cached.guests } : e;
      }),
    }));
    return events;
  },

  // ── Create ─────────────────────────────────────────────────────────────────

  createEvent: async (payload) => {
    const res = await fetchToWeb("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "فشل إنشاء الفعالية");
    set((state) => ({ events: [{ ...data.event, guests: [] }, ...state.events] }));
    return data.event;
  },

  // ── Invite guests ──────────────────────────────────────────────────────────

  inviteGuests: async (eventId, guests) => {
    // guests: [{ name, phone, companions }]
    const res = await fetchToWeb(`/api/events/${eventId}/guests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guests }),
    });
    const data = await res.json();
    // 201 = sent, 202 = saved but WhatsApp disconnected
    if (res.status !== 201 && res.status !== 202) {
      throw new Error(data.error || "فشل إرسال الدعوات");
    }

    // Merge new guests into the cached event
    if (data.guests?.length) {
      set((state) => ({
        events: state.events.map((e) =>
          e.id === eventId
            ? { ...e, guests: [...(e.guests ?? []), ...data.guests] }
            : e,
        ),
      }));
    }
    return data;
  },

  // ── Fetch single event with full guest list ────────────────────────────────

  fetchEventDetail: async (eventId) => {
    const res = await fetchToWeb(`/api/events/${eventId}`);
    if (!res.ok) throw new Error("فشل تحميل تفاصيل الفعالية");
    const { event, guests } = await res.json();
    const full = { ...event, guests: guests ?? [] };
    set((state) => ({
      events: state.events.some((e) => e.id === eventId)
        ? state.events.map((e) => (e.id === eventId ? full : e))
        : [...state.events, full],
    }));
    return full;
  },

  // ── Local helpers ──────────────────────────────────────────────────────────

  getEvent: (id) => get().events.find((e) => e.id === id),

  setEventGuests: (eventId, guests) =>
    set((state) => ({
      events: state.events.map((e) =>
        e.id === eventId ? { ...e, guests } : e,
      ),
    })),
}));

export default useEventStore;
