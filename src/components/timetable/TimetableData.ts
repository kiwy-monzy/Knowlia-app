export type TimetableSession = {
  subject: string
  location: string
  start: string
  end: string
  type: string
  event_type?: string // Unified field for session type (optional for backward compatibility)
  shortCode?: string // e.g., CS175, IS171
}

export type TimetableDay = {
  day: string
  sessions: TimetableSession[]
}

export type TimetableWeek = {
  week: string
  days: TimetableDay[]
}

export type Timetable = {
  id: string
  data: TimetableWeek[]
  status: String
}

// Default empty timetable data (will be populated from Rust backend)
export const defaultTimetableWeek: TimetableWeek = {
  week: "Current Week",
  days: [
    { day: "Monday", sessions: [] },
    { day: "Tuesday", sessions: [] },
    { day: "Wednesday", sessions: [] },
    { day: "Thursday", sessions: [] },
    { day: "Friday", sessions: [] },
  ]
}

// Legacy data for fallback (will be replaced by database data)
export const timetableWeek: TimetableDay[] = [
  {
    day: "Monday",
    sessions: [
      {
        subject: "Mathematics",
        location: "Room 101",
        start: "07:00",
        end: "07:55",
        type: "lecture",
        shortCode: "MATH101",
      },
      {
        subject: "Project Lab (3hr)",
        location: "Lab 201",
        start: "10:00",
        end: "12:55",
        type: "lab",
        shortCode: "LAB201",
      },
      {
        subject: "Statistics",
        location: "Room 104",
        start: "13:00",
        end: "13:55",
        type: "lecture",
        shortCode: "STAT104",
      },
      {
        subject: "Economics",
        location: "Room 106",
        start: "17:00",
        end: "17:55",
        type: "lecture",
        shortCode: "ECON106",
      },
      {
        subject: "Robotics (2hr)",
        location: "Lab 203",
        start: "19:00",
        end: "20:55",
        type: "workshop",
        shortCode: "ROBO203",
      },
    ],
  },
  {
    day: "Tuesday",
    sessions: [
      {
        subject: "Workshop (2hr)",
        location: "Room 202",
        start: "09:00",
        end: "10:55",
        type: "workshop",
        shortCode: "WS202",
      },
      {
        subject: "Psychology",
        location: "Room 111",
        start: "12:00",
        end: "12:55",
        type: "seminar",
        shortCode: "PSY111",
      },
      {
        subject: "Music Theory",
        location: "Room 113",
        start: "14:00",
        end: "14:55",
        type: "tutorial",
        shortCode: "MUS113",
      },
      {
        subject: "Web Design (2hr)",
        location: "Lab 204",
        start: "16:00",
        end: "17:55",
        type: "practical",
        shortCode: "WEB204",
      }
    ],
  },
  {
    day: "Wednesday",
    sessions: [
      {
        subject: "Geography",
        location: "Room 107",
        start: "08:00",
        end: "08:55",
        type: "seminar",
        shortCode: "GEOG107",
      },
      {
        subject: "Geography",
        location: "Room 107",
        start: "08:00",
        end: "08:55",
        type: "seminar",
        shortCode: "GEOG107",
      },
      {
        subject: "Business Studies",
        location: "Room 121",
        start: "14:00",
        end: "14:55",
        type: "lecture",
        shortCode: "BUS121",
      },
      {
        subject: "Marketing",
        location: "Room 122",
        start: "15:00",
        end: "15:55",
        type: "seminar",
        shortCode: "MKT122",
      },
      {
        subject: "Public Speaking",
        location: "Room 123",
        start: "18:00",
        end: "18:55",
        type: "tutorial",
        shortCode: "SPEAK123",
      }
    ],
  },
  {
    day: "Thursday",
    sessions: [
      {
        subject: "Literature",
        location: "Room 110",
        start: "09:00",
        end: "10:55",
        type: "seminar",
        shortCode: "LIT110",
      },
      {
        subject: "Political Science",
        location: "Room 125",
        start: "11:00",
        end: "11:55",
        type: "lecture",
        shortCode: "POL125",
      },
      {
        subject: "Anthropology",
        location: "Room 126",
        start: "12:00",
        end: "12:55",
        type: "seminar",
        shortCode: "ANTH126",
      },
      {
        subject: "Machine Learning",
        location: "Room 127",
        start: "15:00",
        end: "15:55",
        type: "lecture",
        shortCode: "ML127",
      },
      {
        subject: "Sculpture",
        location: "Room 129",
        start: "19:00",
        end: "19:55",
        type: "tutorial",
        shortCode: "SCULP129",
      },
    ],
  },
  {
    day: "Friday",
    sessions: [
      {
        subject: "Physical Education",
        location: "Gym",
        start: "07:00",
        end: "07:55",
        type: "practical",
        shortCode: "PE101",
      },
      {
        subject: "Music",
        location: "Room 110",
        start: "08:00",
        end: "08:55",
        type: "tutorial",
        shortCode: "MUS110",
      },
      {
        subject: "Drama Club",
        location: "Room 132",
        start: "11:00",
        end: "11:55",
        type: "seminar",
        shortCode: "DRAMA132",
      },
      {
        subject: "Biochemistry (2hr)",
        location: "Lab 307",
        start: "13:00",
        end: "14:55",
        type: "practical",
        shortCode: "BIOC307",
      },
      {
        subject: "Sociolinguistics",
        location: "Room 135",
        start: "16:00",
        end: "16:55",
        type: "seminar",
        shortCode: "SOC135",
      },
      {
        subject: "Genetics (3hr)",
        location: "Lab 308",
        start: "17:00",
        end: "19:55",
        type: "lab",
        shortCode: "GEN308",
      }
    ],
  },
]

// --- Exam Timetable Types ---
export type ExamSession = {
  subject: string
  location: string
  start: string
  end: string
  type: string // 'examination'
  shortCode?: string
}

export type ExamDay = {
  day: string
  sessions: ExamSession[]
}

export type ExamWeek = {
  week: string
  days: ExamDay[]
}

export type TimetableType = 'normal' | 'exam';

// --- Exam Timetable Data ---
export const examWeeks: ExamWeek[] = [
  {
    week: "Week 15",
    days: [
      {
        day: "Wednesday",
        sessions: [
          {
            subject: "Web Programming",
            location: "B305 Kijitonyama",
            start: "15:30",
            end: "19:30",
            type: "examination",
            shortCode: "IS181"
          },
          {
            subject: "Web Programming",
            location: "D01 Luhanga Hall Kijitonyama",
            start: "15:30",
            end: "19:30",
            type: "examination",
            shortCode: "IS181"
          },
          {
            subject: "Web Programming",
            location: "B310 Kijitonyama",
            start: "15:30",
            end: "19:30",
            type: "examination",
            shortCode: "IS181"
          }
        ]
      }
    ]
  },
  {
    week: "Week 16",
    days: [
      {
        day: "Friday",
        sessions: [
          {
            subject: "Programming in Java",
            location: "B302 Kijitonyama",
            start: "07:30",
            end: "11:30",
            type: "examination",
            shortCode: "CS175"
          },
          {
            subject: "Programming in Java",
            location: "B305 Kijitonyama",
            start: "07:30",
            end: "11:30",
            type: "examination",
            shortCode: "CS175"
          },
          {
            subject: "Programming in Java",
            location: "D01 Luhanga Hall Kijitonyama",
            start: "07:30",
            end: "11:30",
            type: "examination",
            shortCode: "CS175"
          },
          {
            subject: "Programming in Java",
            location: "B307 Kijitonyama",
            start: "07:30",
            end: "11:30",
            type: "examination",
            shortCode: "CS175"
          }
        ]
      }
    ]
  },
  {
    week: "Week 17",
    days: [
      {
        day: "Wednesday",
        sessions: [
          {
            subject: "Introduction to Computer Networks",
            location: "B302 Kijitonyama",
            start: "07:30",
            end: "11:30",
            type: "examination",
            shortCode: "IS171"
          },
          {
            subject: "Introduction to Computer Networks",
            location: "B305 Kijitonyama",
            start: "07:30",
            end: "11:30",
            type: "examination",
            shortCode: "IS171"
          },
          {
            subject: "Introduction to Computer Networks",
            location: "D01 Luhanga Hall Kijitonyama",
            start: "07:30",
            end: "11:30",
            type: "examination",
            shortCode: "IS171"
          },
          {
            subject: "Introduction to Computer Networks",
            location: "B307 Kijitonyama",
            start: "07:30",
            end: "11:30",
            type: "examination",
            shortCode: "IS171"
          }
        ]
      },
      {
        day: "Thursday",
        sessions: [
          {
            subject: "Discrete Structures",
            location: "B307 Kijitonyama",
            start: "07:30",
            end: "11:30",
            type: "examination",
            shortCode: "IS143"
          },
          {
            subject: "Discrete Structures",
            location: "B310 Kijitonyama",
            start: "07:30",
            end: "11:30",
            type: "examination",
            shortCode: "IS143"
          }
        ]
      },
      {
        day: "Friday",
        sessions: [
          {
            subject: "Computer Hardware and System Maintenance",
            location: "B302 Kijitonyama",
            start: "07:30",
            end: "11:30",
            type: "examination",
            shortCode: "IS158"
          },
          {
            subject: "Computer Hardware and System Maintenance",
            location: "B310 Kijitonyama",
            start: "07:30",
            end: "11:30",
            type: "examination",
            shortCode: "IS158"
          },
          {
            subject: "Computer Hardware and System Maintenance",
            location: "B206 Kijitonyama",
            start: "07:30",
            end: "11:30",
            type: "examination",
            shortCode: "IS158"
          }
        ]
      },
      {
        day: "Monday",
        sessions: [
          {
            subject: "Business Computer Communication",
            location: "B305 Kijitonyama",
            start: "11:30",
            end: "15:30",
            type: "examination",
            shortCode: "CS173"
          },
          {
            subject: "Business Computer Communication",
            location: "B307 Kijitonyama",
            start: "11:30",
            end: "15:30",
            type: "examination",
            shortCode: "CS173"
          },
          {
            subject: "Business Computer Communication",
            location: "B310 Kijitonyama",
            start: "11:30",
            end: "15:30",
            type: "examination",
            shortCode: "CS173"
          },
          {
            subject: "Business Computer Communication",
            location: "B206 Kijitonyama",
            start: "11:30",
            end: "15:30",
            type: "examination",
            shortCode: "CS173"
          }
        ]
      }
    ]
  }
];

// Export a flag or config to distinguish timetable type
export const timetableType: TimetableType = 'normal'; // or 'exam' (set dynamically in UI)

// Unified timetable data structure
export const timetableData = [
  {
    type: 'normal',
    weeks: timetableWeek,
  },
  {
    type: 'exam',
    weeks: examWeeks,
  },
];
