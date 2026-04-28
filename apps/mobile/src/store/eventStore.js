import { create } from "zustand";

const generateTicketId = () =>
  "TKT-" + Math.random().toString(36).substr(2, 6).toUpperCase();

const MOCK_EVENTS = [
  {
    id: "1",
    name: "مؤتمر ريادة الأعمال الخليجي 2025",
    date: "2025-05-15",
    time: "09:00 ص",
    venue: "قاعة الملك فهد للمؤتمرات",
    location: "الرياض، المملكة العربية السعودية",
    description:
      "مؤتمر سنوي يجمع رواد الأعمال والمستثمرين من دول الخليج لتبادل الخبرات ومناقشة أحدث التوجهات.",
    category: "مؤتمر",
    capacity: 200,
    guests: [
      {
        id: "g1",
        name: "أحمد العمري",
        phone: "+966501234567",
        status: "confirmed",
        ticketId: "TKT-AE001",
      },
      {
        id: "g2",
        name: "نورة الشمري",
        phone: "+966507654321",
        status: "invited",
        ticketId: "TKT-NS002",
      },
      {
        id: "g3",
        name: "خالد المطيري",
        phone: "+966509876543",
        status: "pending",
        ticketId: "TKT-KM003",
      },
    ],
  },
  {
    id: "2",
    name: "حفل إطلاق منتج أفق X",
    date: "2025-06-02",
    time: "06:00 م",
    venue: "برج المملكة — الطابق العلوي",
    location: "الرياض، المملكة العربية السعودية",
    description:
      "حفل إطلاق حصري بحضور الصحفيين والشركاء وكبار العملاء للاطلاع على أحدث الابتكارات.",
    category: "إطلاق",
    capacity: 80,
    guests: [
      {
        id: "g4",
        name: "سارة الدوسري",
        phone: "+966502345678",
        status: "confirmed",
        ticketId: "TKT-SD004",
      },
      {
        id: "g5",
        name: "محمد القحطاني",
        phone: "+966508765432",
        status: "invited",
        ticketId: "TKT-MQ005",
      },
    ],
  },
  {
    id: "3",
    name: "ورشة عمل التصميم الإبداعي",
    date: "2025-05-28",
    time: "10:00 ص",
    venue: "مركز الإبداع والابتكار",
    location: "جدة، المملكة العربية السعودية",
    description:
      "ورشة عمل تفاعلية حول أحدث أساليب التصميم وتجربة المستخدم مع حالات دراسية من السوق الخليجية.",
    category: "ورشة عمل",
    capacity: 30,
    guests: [],
  },
];

const useEventStore = create((set, get) => ({
  events: MOCK_EVENTS,

  addEvent: (event) =>
    set((state) => ({
      events: [
        ...state.events,
        { ...event, id: Date.now().toString(), guests: [] },
      ],
    })),

  getEvent: (id) => get().events.find((e) => e.id === id),

  addGuestToEvent: (eventId, guest) =>
    set((state) => ({
      events: state.events.map((e) =>
        e.id === eventId
          ? {
              ...e,
              guests: [
                ...e.guests,
                {
                  ...guest,
                  id: Date.now().toString(),
                  ticketId: generateTicketId(),
                  status: "invited",
                },
              ],
            }
          : e,
      ),
    })),

  addGuestsToEvent: (eventId, guests) =>
    set((state) => ({
      events: state.events.map((e) =>
        e.id === eventId
          ? {
              ...e,
              guests: [
                ...e.guests,
                ...guests.map((g) => ({
                  ...g,
                  id: Date.now().toString() + Math.random(),
                  ticketId: generateTicketId(),
                  status: "invited",
                })),
              ],
            }
          : e,
      ),
    })),

  updateGuestStatus: (eventId, guestId, status) =>
    set((state) => ({
      events: state.events.map((e) =>
        e.id === eventId
          ? {
              ...e,
              guests: e.guests.map((g) =>
                g.id === guestId ? { ...g, status } : g,
              ),
            }
          : e,
      ),
    })),
}));

export default useEventStore;
