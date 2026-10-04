export type ArchivePost = {
  slug: string;
  title: string;
  date: string;
  timestamp: number;
  description: string;
  excerpt: string;
  category: string;
  series: string;
  seriesTitle: string;
  seriesOrder?: number;
  tags: string[];
  url: string;
  contentUrl: string;
  headings: { depth: number; slug: string; text: string }[];
};

export type ArchiveSeries = {
  slug: string;
  title: string;
  description: string;
  parent: string;
  order?: number;
  posts: string[];
};

export type { ContributionActivitySnapshot, ContributionDetailsSnapshot, ContributionDetail, SourceRecord } from "../../lib/contributions/types";
