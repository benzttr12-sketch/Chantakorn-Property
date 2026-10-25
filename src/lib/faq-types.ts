export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  tag: string;
  tip?: string;
}

export interface FAQCategoryData {
  category: string;
  categoryTitle: string;
  faqs: FAQItem[];
  source: 'curated-expert-database';
}
