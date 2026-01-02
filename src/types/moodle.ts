export interface SiteInfo {
  sitename?: string;
  username: string;
  firstname?: string;
  lastname?: string;
  fullname: string;
  lang?: string;
  userid?: number;
  siteurl?: string;
  userpictureurl?: string;
  functions?: Array<{ name: string; version: string }>;
  downloadfiles?: number;
  uploadfiles?: number;
  release?: string;
  version?: string;
  mobilecssurl?: string;
  advancedfeatures?: Array<{ name: string; value: number }>;
  usercanmanageownfiles?: boolean;
  userquota?: number;
  usermaxuploadfilesize?: number;
  userhomepage?: number;
  userprivatetoken?: string;
}

export interface Course {
  id: number;
  fullname: string;
  shortname: string;
  summary?: string;
  summaryformat?: number;
  categoryid?: number;
  categoryname?: string;
  format?: string;
  startdate?: number;
  enddate?: number;
}

export interface Assignment {
  id: number;
  cmid: number;
  course: number;
  name: string;
  nosubmissions: number;
  submissiondrafts: number;
  sendnotifications: number;
  sendlatenotifications: number;
  duedate: number;
  allowsubmissionsfromdate: number;
  grade: number;
  timemodified: number;
  completionsubmit: number;
  cutoffdate: number;
  teamsubmission: number;
  requireallteammemberssubmit: number;
  teamsubmissiongroupingid: number;
  blindmarking: number;
  hidegrader: number;
  revealidentities: number;
  attemptreopenmethod: string;
  maxattempts: number;
  markingworkflow: number;
  markingallocation: number;
  requiresubmissionstatement: number;
}
