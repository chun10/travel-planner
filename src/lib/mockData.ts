import { ItineraryDay } from './types';

// Helper to generate stable UUIDs for mock data
function uuid(): string {
  return crypto.randomUUID();
}

// Pre-generate IDs so they're stable across renders
const IDS = {
  day1: uuid(),
  day2: uuid(),
  day3: uuid(),
  evt1: uuid(),
  evt2: uuid(),
  evt3: uuid(),
  evt4: uuid(),
  evt5: uuid(),
  evt6: uuid(),
  evt7: uuid(),
  evt8: uuid(),
  link1: uuid(),
  link2: uuid(),
  link3: uuid(),
  link4: uuid(),
  link5: uuid(),
};

export const initialItinerary: ItineraryDay[] = [
  {
    id: IDS.day1,
    date: '2026-04-10',
    title: '抵達東京與淺草觀光',
    events: [
      {
        id: IDS.evt1,
        time: '13:00',
        locationName: '成田國際機場 (NRT)',
        coordinates: { lat: 35.7719867, lng: 140.3928501 },
        description: '抵達機場，領取行李並兌換地鐵票券。',
        links: [
          {
            id: IDS.link1,
            title: '酷航航班憑證',
            url: '#',
            type: 'flight'
          }
        ],
        transportToNext: {
          mode: 'TRANSIT',
          duration: '約 1 小時 15 分鐘',
          instructions: '搭乘 Skyliner 至上野，轉乘銀座線至淺草'
        }
      },
      {
        id: IDS.evt2,
        time: '15:30',
        locationName: '淺草豪景飯店 (Asakusa View Hotel)',
        coordinates: { lat: 35.7142, lng: 139.7915 },
        description: '辦理入住，放置行李。',
        links: [
          {
            id: IDS.link2,
            title: 'Agoda 訂房確認信',
            url: '#',
            type: 'hotel'
          }
        ],
        transportToNext: {
          mode: 'WALKING',
          duration: '約 10 分鐘',
          instructions: '沿著雷門通步行'
        }
      },
      {
        id: IDS.evt3,
        time: '16:00',
        locationName: '淺草寺、雷門',
        coordinates: { lat: 35.714765, lng: 139.796655 },
        description: '參拜淺草寺，逛仲見世通商店街吃點心。',
      }
    ]
  },
  {
    id: IDS.day2,
    date: '2026-04-11',
    title: '澀谷與原宿一日遊',
    events: [
      {
        id: IDS.evt4,
        time: '09:30',
        locationName: '明治神宮',
        coordinates: { lat: 35.6763976, lng: 139.6993259 },
        description: '清晨參拜，享受芬多精。',
        transportToNext: {
          mode: 'WALKING',
          duration: '約 15 分鐘',
          instructions: '步行至原宿車站周邊'
        }
      },
      {
        id: IDS.evt5,
        time: '11:30',
        locationName: '原宿竹下通',
        coordinates: { lat: 35.6715694, lng: 139.7030805 },
        description: '逛街、吃可麗餅。',
        transportToNext: {
          mode: 'TRANSIT',
          duration: '約 5 分鐘',
          instructions: '搭乘 JR 山手線至澀谷站'
        }
      },
      {
        id: IDS.evt6,
        time: '14:00',
        locationName: '澀谷十字路口 (Shibuya Scramble Crossing)',
        coordinates: { lat: 35.65951, lng: 139.700514 },
        description: '體驗世界最繁忙的十字路口，至 Shibuya Sky 觀景。',
        links: [
          {
            id: IDS.link3,
            title: 'Shibuya Sky 門票 Klook',
            url: '#',
            type: 'booking'
          }
        ]
      }
    ]
  },
  {
    id: IDS.day3,
    date: '2026-04-12',
    title: '東京迪士尼樂園',
    events: [
      {
        id: IDS.evt7,
        time: '08:30',
        locationName: '東京迪士尼樂園 (Tokyo Disneyland)',
        coordinates: { lat: 35.632896, lng: 139.880394 },
        description: '入園後先抽 FastPass，順序遊玩熱門設施。',
        links: [
          {
            id: IDS.link4,
            title: '門票確認信',
            url: '#',
            type: 'booking'
          }
        ],
        transportToNext: {
          mode: 'TRANSIT',
          duration: '約 1 小時',
          instructions: '搭乘 JR 京葉線至舞濱站'
        }
      },
      {
        id: IDS.evt8,
        time: '20:00',
        locationName: '迪士尼煙火表演',
        coordinates: { lat: 35.632896, lng: 139.880394 },
        description: '欣賞閉園前的煙火秀，結束美好的迪士尼之旅！',
        links: [
          {
            id: IDS.link5,
            title: '迪士尼官方 APP',
            url: '#',
            type: 'other'
          }
        ]
      }
    ]
  }
];
