export interface CourseLesson {
  id: number;
  stt: string;
  content: string;
  topics: string[]; // Detailed topics/bullet points extracted from content column
  cdr: string;
  assessment: string; // "Bài KT, ĐG" (A1.1, A2.1...)
  totalPeriods: number;
  classPeriods: number; // Số tiết trên lớp
  theoryPeriods: number; // LT
  discussionPeriods: number; // TL
  practiceGroupPeriods: number; // TH N
  practiceIndividualPeriods: number; // TH Đ
  exercisePeriods: number; // BT (TN)
  guidedStudyPeriods: number; // Học có HD
  selfStudyPeriods: number; // Tự học
  materials: string;
  // AI-selected curated topics:
  discussionTopics?: string[]; // Nội dung thảo luận được AI chọn lọc phù hợp số tiết TL
  guidedStudyTopics?: string[]; // Nội dung tự học có HD được AI chọn lọc phù hợp số tiết HD
  selfStudyTopics?: string[]; // Nội dung tự học được AI chọn lọc phù hợp số tiết tự học
  aiCurated?: boolean;
}

export interface CustomTemplateColumn {
  id: string;
  header: string;
  subHeader?: string;
  type: 'lesson' | 'content' | 'cdr' | 'teacher_activity' | 'student_activity' | 'activities_combined' | 'assessment' | 'other';
  widthPercent?: number;
}

export interface CustomTemplateAnalysis {
  title: string;
  subtitle?: string;
  hasTwoHeaderRows: boolean;
  columns: CustomTemplateColumn[];
  activityStyle: 'split_teacher_student' | 'combined_activities' | 'section_by_period';
  specialNotes?: string;
}

export interface TeachingPlanTemplate {
  id: string;
  name: string;
  description: string;
  badge: string;
  isCustomUpload?: boolean;
  analysis?: CustomTemplateAnalysis;
}

export interface ProcessingStatus {
  step: 'idle' | 'parsing' | 'analyzing-template' | 'curating' | 'generating' | 'completed' | 'error';
  message: string;
}

export type AIProvider = 'gemini' | 'ollama';

export interface OllamaModelOption {
  id: string;
  name: string;
  tag: string;
  badge: string;
  description: string;
}

export interface OllamaConfig {
  host: string;
  model: string;
  customModelName?: string;
}