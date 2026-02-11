export type QuizOption = {
  id: string;
  text: string;
};

export type QuizQuestion = {
  id: string;
  question: string;
  options: QuizOption[];
  correctOptionId: string;
  image?: string | null;
};

export type QuizData = {
  easy: QuizQuestion[];
  medium: QuizQuestion[];
  hard: QuizQuestion[];
};
