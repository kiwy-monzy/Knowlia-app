export interface Property {
  id: string;
  title: string;
  location: string;
  price: number;
  priceFormatted: string;
  area: string;
  rooms: string;
  parking: string;
  images: string[];
  isHot?: boolean;
  description: string;
  coordinates: [number, number];
  bedrooms: number;
  bathrooms: number;
  garages: number;
  agent: {
    name: string;
    avatar: string;
    phone: string;
    email: string;
  };
}

// BIT Course Program Mock Data Structure
export interface CourseFolder {
  id: string;
  name: string;
  googleDriveFolderId: string;
  isFolder: boolean;
  children?: CourseFolder[];
}

export interface YearFolder {
  id: string;
  name: string;
  year: string;
  googleDriveFolderId: string;
  isFolder: boolean;
  children: SemesterFolder[];
}

export interface SemesterFolder {
  id: string;
  name: string;
  googleDriveFolderId: string;
  isFolder: boolean;
  children: CourseFolder[];
}

// BIT Course Program Mock Data
export const BIT_COURSE_STRUCTURE: YearFolder[] = [
  {
    id: "year-1",
    name: "Year 1 (2022–2023)",
    year: "2022-2023",
    googleDriveFolderId: "BIT_YEAR_1_ROOT", // This would be the parent folder for Year 1
    isFolder: true,
    children: [
      {
        id: "year-1-semester-1",
        name: "Semester 1",
        googleDriveFolderId: "BIT_Y1_S1_ROOT", // Parent folder for Semester 1
        isFolder: true,
        children: [
          {
            id: "ac100",
            name: "AC100 Principles of Accounting",
            googleDriveFolderId: "1SuwmI60Xi5m1GkPW3gKEX96OgHpG77UO",
            isFolder: true
          },
          {
            id: "c174",
            name: "C174 Programming in C",
            googleDriveFolderId: "1Si_DZC52T-U01HWAbg7RsqN562W7pok1",
            isFolder: true
          },
          {
            id: "ds112",
            name: "DS112 Development Perspective I",
            googleDriveFolderId: "1SphRnJ-gyWUWhttWZvPbOX9PGdaN0VpW",
            isFolder: true
          },
          {
            id: "fn100",
            name: "FN100 Microeconomics Analysis",
            googleDriveFolderId: "1T2Jea81LdIgyBBGX6Cfj59BCFStNpz8b",
            isFolder: true
          },
          {
            id: "mk100",
            name: "MK100 Introduction to Business",
            googleDriveFolderId: "1T7XR6Iawu1v4n5wDavWYyo_NRmUlkFBu",
            isFolder: true
          },
          {
            id: "st113",
            name: "ST113 Basic Statistics",
            googleDriveFolderId: "1Spt7qOxmJkh1Fu7OE26I8OteY73eoaJY",
            isFolder: true
          }
        ]
      },
      {
        id: "year-1-semester-2",
        name: "Semester 2",
        googleDriveFolderId: "BIT_Y1_S2_ROOT", // Parent folder for Semester 2
        isFolder: true,
        children: [
          {
            id: "cs173",
            name: "CS173 Business Computer Communication",
            googleDriveFolderId: "1Yj0LYl8wmHnPXYKrw1CEHXyTaiTBFahL",
            isFolder: true
          },
          {
            id: "ds113",
            name: "DS113 Development Perspective II",
            googleDriveFolderId: "1Z-igns444NTOi8KnZZeQttHos-Mf9M1U",
            isFolder: true
          },
          {
            id: "fn101",
            name: "FN101 Microeconomics Analysis",
            googleDriveFolderId: "1YtqqZAVAShgDhtmP-U2yqAXZYN6BFD26",
            isFolder: true
          },
          {
            id: "gm100",
            name: "GM100 Principles of Management",
            googleDriveFolderId: "1Z-MCe1k0PvBuzvLQ6_BskfDEFjfebDE9",
            isFolder: true
          },
          {
            id: "is171",
            name: "IS171 Intro to Networking",
            googleDriveFolderId: "1YmTD26_fR7MqG6PorLwalXptoolturV6",
            isFolder: true
          },
          {
            id: "is181",
            name: "IS181 Web Programming",
            googleDriveFolderId: "1YqB75nl7D6ECRrj7OhOqkuHuwAD8PDO4",
            isFolder: true
          },
          {
            id: "st114",
            name: "ST114 Probability Theory I",
            googleDriveFolderId: "1YmL0HGdx6opoxx4gRg7rmy0dkQNXMFR8",
            isFolder: true
          }
        ]
      }
    ]
  },
  {
    id: "year-2",
    name: "Year 2 (2023–2024)",
    year: "2023-2024",
    googleDriveFolderId: "BIT_YEAR_2_ROOT", // This would be the parent folder for Year 2
    isFolder: true,
    children: [
      {
        id: "year-2-semester-1",
        name: "Semester 1",
        googleDriveFolderId: "BIT_Y2_S1_ROOT", // Parent folder for Semester 1
        isFolder: true,
        children: [
          {
            id: "is236",
            name: "IS236 Structured System & Analysis",
            googleDriveFolderId: "1mQe3w-ZIZJnTuEnaKRborf0KelolYshd",
            isFolder: true
          },
          {
            id: "is264",
            name: "IS264 Database Management",
            googleDriveFolderId: "1mACCmI81ttZdjzLpB9sZwcpkl2H7AVcY",
            isFolder: true
          },
          {
            id: "is237",
            name: "IS237 Data Abstraction & Algorithms",
            googleDriveFolderId: "1mBYAmVSgovQ1ZNjX9HpZk6_DjO7B1ocQ",
            isFolder: true
          },
          {
            id: "is238",
            name: "IS238 Mobile App Development",
            googleDriveFolderId: "1mVBSQJhpYIMADgKW7ZdUdNB9v58JAXSi",
            isFolder: true
          },
          {
            id: "is265",
            name: "IS265 Introduction to GIS",
            googleDriveFolderId: "1mOcuhm9zpfRLWsg3dqleJQU5cDV1Hf9x",
            isFolder: true
          }
        ]
      },
      {
        id: "year-2-semester-2",
        name: "Semester 2",
        googleDriveFolderId: "BIT_Y2_S2_ROOT", // Parent folder for Semester 2
        isFolder: true,
        children: [
          {
            id: "cs243",
            name: "CS243 OOP in Java",
            googleDriveFolderId: "1Jp251PbPmAd9ATiOwTkkKDzztXMH9PBX",
            isFolder: true
          },
          {
            id: "gm200",
            name: "GM200 Business Law & Ethics",
            googleDriveFolderId: "1IVqJdeb01GZSiJmTD9-Fl9_xRs2jh08t",
            isFolder: true
          },
          {
            id: "is274",
            name: "IS274 OO Analysis & Design",
            googleDriveFolderId: "1Iaqjdd8y-uL55gjM_sULdUScxlLYaFsH",
            isFolder: true
          },
          {
            id: "is284",
            name: "IS284 Business Process Mgmt",
            googleDriveFolderId: "1IKe0ABWFeuxm8EeVwqRp2t7wrSPwDAYi",
            isFolder: true
          },
          {
            id: "is285",
            name: "IS285 Programming in R",
            googleDriveFolderId: "1ISPJsxjkdCLGGDJUp-72HbfMB0Ix_7Se",
            isFolder: true
          },
          {
            id: "st119",
            name: "ST119 Operations Research I",
            googleDriveFolderId: "1I_Qun8uh40O1z6ea0V3oX9BsWVOmK5Zx",
            isFolder: true
          }
        ]
      }
    ]
  },
  {
    id: "year-3",
    name: "Year 3 (2024–2025)",
    year: "2024-2025",
    googleDriveFolderId: "BIT_YEAR_3_ROOT", // This would be the parent folder for Year 3
    isFolder: true,
    children: [
      {
        id: "year-3-semester-1",
        name: "Semester 1",
        googleDriveFolderId: "BIT_Y3_S1_ROOT", // Parent folder for Semester 1
        isFolder: true,
        children: [
          {
            id: "cs334",
            name: "CS334 Operating Systems",
            googleDriveFolderId: "1-EVfSAu1YWmY-HLR8rOx98gX-oRVI04l",
            isFolder: true
          },
          {
            id: "cs335",
            name: "CS335 Software Engineering",
            googleDriveFolderId: "1-H0e5YF36VbJgQqdgA7YmGQ6_Cs0LK2B",
            isFolder: true
          },
          {
            id: "cs336",
            name: "CS336 IT Trends & Socio-Culture",
            googleDriveFolderId: "1-NeA-7GbbhRQ027pJF_oXgSek98Xzt1l",
            isFolder: true
          },
          {
            id: "cs369",
            name: "CS369 IT Audit & Control",
            googleDriveFolderId: "1-HQ0mbupt3KSOnEmGJI6R9B4KX5qcIRF",
            isFolder: true
          },
          {
            id: "gm300",
            name: "GM300 Strategic Management",
            googleDriveFolderId: "12SbuAth1QrTzz-x-KrewNm2Oy6B5pGib",
            isFolder: true
          }
        ]
      },
      {
        id: "year-3-semester-2",
        name: "Semester 2",
        googleDriveFolderId: "BIT_Y3_S2_ROOT", // Parent folder for Semester 2
        isFolder: true,
        children: [
          {
            id: "is336",
            name: "IS336 Systems Security",
            googleDriveFolderId: "1iswg2dT5cz0yviZ7AZzFxNtrJN31IUCq",
            isFolder: true
          },
          {
            id: "is385",
            name: "IS385 Business Intelligence",
            googleDriveFolderId: "1bneay8CyPrvZtyd5pHLZAIalKXPGzbVW",
            isFolder: true
          },
          {
            id: "mk301",
            name: "MK301 Entrepreneurship",
            googleDriveFolderId: "1jAxYgDVMMO4qNq8RgP3y2LRss2h8aXn-",
            isFolder: true
          },
          {
            id: "is384",
            name: "IS384 Software Project Management",
            googleDriveFolderId: "1byQlSS3vPndRwZp6NnABGcQGj6ml7-sL",
            isFolder: true
          },
          {
            id: "is386",
            name: "IS386 Enterprise System",
            googleDriveFolderId: "12Orp9yNusYfv4wpyGC5Pu4AlJ9blHu6K",
            isFolder: true
          },
          {
            id: "is335",
            name: "IS335 Final Year Project",
            googleDriveFolderId: "1VtzBFlSHnxjOkas4_bpjmQIqgw6tNS43",
            isFolder: true
          }
        ]
      }
    ]
  }
];

// Helper function to get folder by ID
export const getBITFolderById = (folderId: string): CourseFolder | YearFolder | SemesterFolder | null => {
  const searchInFolders = (folders: any[]): any => {
    for (const folder of folders) {
      if (folder.id === folderId) return folder;
      if (folder.children) {
        const found = searchInFolders(folder.children);
        if (found) return found;
      }
    }
    return null;
  };
  
  return searchInFolders(BIT_COURSE_STRUCTURE);
};

// Helper function to get all courses for a specific year and semester
export const getBITCoursesBySemester = (year: number, semester: number): CourseFolder[] => {
  const yearData = BIT_COURSE_STRUCTURE.find(y => y.id === `year-${year}`);
  if (!yearData) return [];
  
  const semesterData = yearData.children.find(s => s.id === `year-${year}-semester-${semester}`);
  return semesterData?.children || [];
};

export const properties: Property[] = [
  {
    id: "1",
    title: "Spacious 5-Room House",
    location: "New York, NY",
    price: 180000,
    priceFormatted: "$180,000",
    area: "400 sqm",
    rooms: "5, 2 bath",
    parking: "2 garage",
    images: ["/placeholder.svg", "/placeholder.svg", "/placeholder.svg"],
    isHot: true,
    description: "This stunning 400 sqm home offers spacious living in a peaceful neighborhood. With 5 well-sized rooms and modern amenities throughout, it's perfect for families.",
    coordinates: [40.7580, -73.9855],
    bedrooms: 5,
    bathrooms: 2,
    garages: 2,
    agent: {
      name: "John Doe",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Agent1",
      phone: "+1 (555) 123-4567",
      email: "john.doe@realestate.com"
    }
  },
  {
    id: "2",
    title: "2-Bedroom Apartment",
    location: "New York, NY",
    price: 180000,
    priceFormatted: "$180,000",
    area: "60 m²",
    rooms: "2, 1 bath",
    parking: "1 garage",
    images: ["/placeholder.svg", "/placeholder.svg"],
    isHot: false,
    description: "Modern apartment with beautiful city views. Perfect for young professionals or small families.",
    coordinates: [40.7489, -73.9680],
    bedrooms: 2,
    bathrooms: 1,
    garages: 1,
    agent: {
      name: "Sarah Johnson",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Agent2",
      phone: "+1 (555) 234-5678",
      email: "sarah.j@realestate.com"
    }
  },
  {
    id: "3",
    title: "Modern Family Home",
    location: "Brooklyn, NY",
    price: 245000,
    priceFormatted: "$245,000",
    area: "85 m²",
    rooms: "3, 2 bath",
    parking: "2 garage",
    images: ["/placeholder.svg", "/placeholder.svg", "/placeholder.svg"],
    isHot: true,
    description: "Contemporary home in a family-friendly neighborhood with excellent schools nearby.",
    coordinates: [40.6782, -73.9442],
    bedrooms: 3,
    bathrooms: 2,
    garages: 2,
    agent: {
      name: "Michael Chen",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Agent3",
      phone: "+1 (555) 345-6789",
      email: "m.chen@realestate.com"
    }
  },
  {
    id: "4",
    title: "Luxury Penthouse",
    location: "Manhattan, NY",
    price: 520000,
    priceFormatted: "$520,000",
    area: "120 m²",
    rooms: "4, 3 bath",
    parking: "2 garage",
    images: ["/placeholder.svg", "/placeholder.svg"],
    isHot: true,
    description: "Stunning penthouse with panoramic city views and premium finishes throughout.",
    coordinates: [40.7831, -73.9712],
    bedrooms: 4,
    bathrooms: 3,
    garages: 2,
    agent: {
      name: "Emily Davis",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Agent4",
      phone: "+1 (555) 456-7890",
      email: "emily.d@realestate.com"
    }
  },
  {
    id: "5",
    title: "Cozy Studio",
    location: "Queens, NY",
    price: 140000,
    priceFormatted: "$140,000",
    area: "35 m²",
    rooms: "1, 1 bath",
    parking: "0 garage",
    images: ["/placeholder.svg"],
    isHot: false,
    description: "Perfect starter home or investment property in an up-and-coming neighborhood.",
    coordinates: [40.7282, -73.7949],
    bedrooms: 1,
    bathrooms: 1,
    garages: 0,
    agent: {
      name: "David Wilson",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Agent5",
      phone: "+1 (555) 567-8901",
      email: "d.wilson@realestate.com"
    }
  },
  {
    id: "6",
    title: "Garden Villa",
    location: "Staten Island, NY",
    price: 320000,
    priceFormatted: "$320,000",
    area: "200 m²",
    rooms: "4, 3 bath",
    parking: "3 garage",
    images: ["/placeholder.svg", "/placeholder.svg"],
    isHot: false,
    description: "Beautiful villa with large garden and outdoor entertaining area.",
    coordinates: [40.5795, -74.1502],
    bedrooms: 4,
    bathrooms: 3,
    garages: 3,
    agent: {
      name: "Lisa Martinez",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Agent6",
      phone: "+1 (555) 678-9012",
      email: "lisa.m@realestate.com"
    }
  },
  {
    id: "7",
    title: "Downtown Loft",
    location: "Manhattan, NY",
    price: 285000,
    priceFormatted: "$285,000",
    area: "75 m²",
    rooms: "2, 2 bath",
    parking: "1 garage",
    images: ["/placeholder.svg", "/placeholder.svg", "/placeholder.svg"],
    isHot: true,
    description: "Industrial-style loft in the heart of downtown with high ceilings and exposed brick.",
    coordinates: [40.7589, -73.9851],
    bedrooms: 2,
    bathrooms: 2,
    garages: 1,
    agent: {
      name: "Robert Brown",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Agent7",
      phone: "+1 (555) 789-0123",
      email: "r.brown@realestate.com"
    }
  },
  {
    id: "8",
    title: "Waterfront Condo",
    location: "Brooklyn, NY",
    price: 395000,
    priceFormatted: "$395,000",
    area: "95 m²",
    rooms: "3, 2 bath",
    parking: "1 garage",
    images: ["/placeholder.svg", "/placeholder.svg"],
    isHot: false,
    description: "Stunning waterfront views with modern amenities and easy access to the city.",
    coordinates: [40.6892, -73.9979],
    bedrooms: 3,
    bathrooms: 2,
    garages: 1,
    agent: {
      name: "Jennifer Lee",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Agent8",
      phone: "+1 (555) 890-1234",
      email: "jennifer.l@realestate.com"
    }
  }
];

export interface MarketData {
  month: string;
  propertiesListed: number;
  propertiesSold: number;
}

export const marketData: MarketData[] = [
  { month: "Sep", propertiesListed: 40, propertiesSold: 45 },
  { month: "Oct", propertiesListed: 45, propertiesSold: 52 },
  { month: "Nov", propertiesListed: 42, propertiesSold: 48 },
  { month: "Dec", propertiesListed: 52, propertiesSold: 60 },
  { month: "Jan", propertiesListed: 48, propertiesSold: 55 },
  { month: "Feb", propertiesListed: 50, propertiesSold: 58 },
  { month: "Mar", propertiesListed: 45, propertiesSold: 50 },
];

export interface PriceRange {
  range: string;
  count: number;
  percentage: number;
}

export const priceRanges: PriceRange[] = [
  { range: "$100k", count: 15, percentage: 25 },
  { range: "$200k", count: 27, percentage: 45 },
  { range: "$300k", count: 39, percentage: 65 },
  { range: "$400k", count: 51, percentage: 85 },
  { range: "$500k", count: 33, percentage: 55 },
  { range: "$600k", count: 21, percentage: 35 },
];

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  location: string;
  phone: string;
  memberSince: string;
}

export const currentUser: UserProfile = {
  name: "Noah Turner",
  email: "noah.turner@email.com",
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Noah",
  location: "New York, NY",
  phone: "+1 (555) 123-4567",
  memberSince: "January 2023"
};


export const mapLayers = [
  {
    name: "Vibweta",
    url: "/FULL VIBWETA.geojson",
    visible: false,
    style: {
      strokeColor: "#1a1a1a",
      strokeOpacity: 0,
      weight: 3,
      fillColor: "#dbc5b7",
      fillOpacity: 1
    }
  },
 //{
 //  name: "Lines3",
 //  url: "/FULL LINESS3.geojson",
 //  visible: true, // Make visible for debugging
 //  style: {
 //    strokeColor: "#1a1a1a",
 //    strokeOpacity: 0.5,
 //    weight: 0.5,
 //    fillColor: "",
 //    fillOpacity: 0
 //  }
 //},
  {
    name: "ParkingB",
    url: "/FULL PARKINGB.geojson",
    visible: true, // Make visible for debugging
    style: {
      strokeColor: "#1a1a1a",
      strokeOpacity: 0,
      weight: 3,
      fillColor: "#d3d0cd",
      fillOpacity: 1
    }
  },
  {
    name: "Roads",
    url: "/FULL ROADS.json",
    visible: true, // Make visible for debugging
    style: {
      strokeColor: "#1a1a1a",
      strokeOpacity: 1,
      weight: 2,
      fillColor: "#1a1a1a",
      fillOpacity: 1 // keep roads with no fill
    }
  },
  {
    name: "Blocks",
    url: "/FULL BLOCK.json",
    visible: true, // Make visible for debugging
    style: {
      strokeColor: "#1a1a1a",
      strokeOpacity: 0,
      weight: 3,
      fillColor: "#d3d0cd",
      fillOpacity: 1
    }
  },
  {
    name: "Sport",
    url: "/FULL SPORT.json",
    visible: true, // Make visible for debugging
    style: {
      strokeColor: "#1a1a1a",
      strokeOpacity: 0,
      weight: 3,
      fillColor: "#c2d89a",
      fillOpacity: 1
    }
  },
  {
    name: "Green",
    url: "/FULL GREEN1.json",
    visible: true, // Make visible for debugging
    style: {
      strokeColor: "#1a1a1a",
      strokeOpacity: 0,
      weight: 2,
      fillColor: "#9bb987",
      fillOpacity: 1
    }
  },
  {
    name: "Land",
    url: "/FULL LAND.json",
    visible: true, // Make visible for debugging
    style: {
      strokeColor: "#1a1a1a",
      strokeOpacity: 0,
      weight: 2,
      fillColor: "#eee2d2",
      fillOpacity: 1
    }
  },
    {
    name: "Lines2",
    url: "/map/kijitonyama.geojson",
    visible: true, // Make visible for debugging
    style: {
      strokeColor: "#1a1a1a",
      strokeOpacity: 1,
      weight: 1,
      fillColor: "#ff2f2fff",
      fillOpacity: 0
    }
  },
      {
    name: "Lines2",
    url: "/map/Mikocheni.geojson",
    visible: true, // Make visible for debugging
    style: {
      strokeColor: "#1a1a1a",
      strokeOpacity: 1,
      weight: 1,
      fillColor: "#ff2f2fff",
      fillOpacity: 0
    }
  },
];