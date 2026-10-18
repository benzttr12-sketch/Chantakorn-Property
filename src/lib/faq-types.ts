export type FAQCategory = 'buying' | 'selling' | 'loans' | 'consignment' | 'legal';

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: FAQCategory;
  tag: string;
  tip?: string;
}
